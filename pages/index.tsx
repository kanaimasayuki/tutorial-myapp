import React, { useState, useEffect } from 'react';

// 簡略化のため勘定科目を固定 (DBのaccountsテーブルにある名前に合わせる)
const ACCOUNTS = ['現金', '売上', '売掛金', '買掛金', '消耗品費', '給料手当'];

// テーブルのスタイル定義
const tableHeaderStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'left', backgroundColor: '#f2f2f2' } as React.CSSProperties;
const tableCellStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'left' } as React.CSSProperties;

// 勘定科目別残高のデータ型
interface BalanceItem {
  account_name: string;
  total_debit: string;
  total_credit: string;
  balance: string;
}

const JournalEntry: React.FC = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().substring(0, 10),
    debit_name: '現金', 
    credit_name: '売上', 
    amount: '',
    description: '',
  });
  const [message, setMessage] = useState('');
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(false);

  // APIから集計データを取得する関数
  const fetchBalances = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/balances'); // /api/balances に GET リクエスト
      if (response.ok) {
        const data: BalanceItem[] = await response.json();
        setBalances(data);
      } else {
        setMessage('❌ 集計データの取得に失敗しました。Cloud Runログを確認してください。');
      }
    } catch (error) {
      setMessage('❌ ネットワークエラーにより集計データが取得できませんでした。');
    } finally {
      setLoading(false);
    }
  };
  
  // コンポーネントロード時に一度だけ集計データを取得
  useEffect(() => {
    fetchBalances();
  }, []); 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('登録中...');

    try {
      // 仕訳登録APIに POST リクエスト
      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ 登録成功！仕訳ID: ${data.journal.id}`);
        setFormData(prev => ({ ...prev, amount: '', description: '' })); 
        fetchBalances(); // 成功したら集計データを再ロード
      } else {
        setMessage(`❌ 登録失敗: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ ネットワークエラー。コンソールとCloud Runログを確認してください。`);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>簡易仕訳帳システム</h1>
      {message && <p style={{ color: message.includes('成功') ? 'green' : 'red', fontWeight: 'bold' }}>{message}</p>}
      
      {/* ===== フォーム部分 ===== */}
      <div style={{ marginBottom: '40px', border: '1px solid #ddd', padding: '20px' }}>
          <h2>仕訳入力</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px' }}>
            
            <label>日付: <input type="date" name="date" value={formData.date} onChange={handleChange} required /></label>

            <label>借方 (Dr.): 
                <select name="debit_name" value={formData.debit_name} onChange={handleChange} required>
                    {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
            </label>

            <label>貸方 (Cr.): 
                <select name="credit_name" value={formData.credit_name} onChange={handleChange} required>
                    {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
            </label>

            <label>金額: <input type="number" name="amount" value={formData.amount} onChange={handleChange} min="0.01" step="0.01" required /></label>
            
            <label>摘要: <input type="text" name="description" value={formData.description} onChange={handleChange} /></label>

            <button type="submit" disabled={loading}>
                {loading ? '処理中...' : '仕訳を登録'}
            </button>
          </form>
      </div>

      {/* ===== 集計表示部分 ===== */}
      <h2>勘定科目別残高 (簡易試算表)</h2>
      {loading && <p>集計データを読み込み中...</p>}
      
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>勘定科目</th>
            <th style={tableHeaderStyle}>借方合計 (Dr)</th>
            <th style={tableHeaderStyle}>貸方合計 (Cr)</th>
            <th style={tableHeaderStyle}>残高</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((item) => (
            <tr key={item.account_name}>
              <td style={tableCellStyle}>{item.account_name}</td>
              <td style={tableCellStyle}>{parseFloat(item.total_debit).toLocaleString()}</td>
              <td style={tableCellStyle}>{parseFloat(item.total_credit).toLocaleString()}</td>
              <td style={tableCellStyle as React.CSSProperties & { color: string }}>
                {parseFloat(item.balance).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default JournalEntry;