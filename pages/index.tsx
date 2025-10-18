import React, { useState, useEffect } from 'react';

// 追加: API の型定義
type ApiBalance = {
  account_name: string;
  accountName?: string; // ← 追加: サーバー側の別名を許容
  debit_total?: number | string;
  credit_total?: number | string;
  home_signed_balance?: number | string;
  total_debit?: number | string;
  total_credit?: number | string;
  balance?: number | string;
  raw_balance?: number | string;
};

type JournalResponse = { journalId?: number | string; message?: string; error?: string };

// 簡略化のため勘定科目を固定 (DBのaccountsテーブルにある名前に合わせる)
const ACCOUNTS = ['現金', '売上', '売掛金', '買掛金', '消耗品費', '給料手当'];

// テーブルのスタイル定義
const tableHeaderStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'left', backgroundColor: '#f2f2f2' } as React.CSSProperties;
const tableCellStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'left' } as React.CSSProperties;

// 勘定科目別残高のデータ型
interface BalanceItem {
  account_name: string;
  // API側は number を返すので数値または文字列を許容
  total_debit: number | string;
  total_credit: number | string;
  balance: number | string;
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
        const apiData: ApiBalance[] = await response.json();
        // APIのフィールド名(debit_total, credit_total, home_signed_balance)を
        // フロントが期待する形にマップする
        const data: BalanceItem[] = apiData.map((it) => ({
          account_name: it.account_name ?? it.accountName ?? '',
          total_debit: it.debit_total ?? it.total_debit ?? 0,
          total_credit: it.credit_total ?? it.total_credit ?? 0,
          balance: it.home_signed_balance ?? it.balance ?? it.raw_balance ?? 0,
        }));
        setBalances(data);
      } else {
        setMessage('❌ 集計データの取得に失敗しました。Cloud Runログを確認してください。');
      }
    } catch (err) {
      console.error('[fetchBalances] error', err);
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

  // API送信を安全に行うユーティリティ
  async function submitJournal(body: Record<string, unknown>, onSuccess?: (data: JournalResponse) => void) {
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log('[journal] fetch done status=', res.status, res.statusText);

      const text = await res.text();
      console.log('[journal] response text=', text);
      let data: JournalResponse | null = null;
      try { data = text ? (JSON.parse(text) as JournalResponse) : null; } catch (e) {
        console.error('[journal] JSON parse error', e);
        throw new Error('Invalid JSON response from server');
      }

      if (!res.ok) {
        // サーバーからのエラーメッセージがあればそれを投げる
        const msg = data?.message ?? data?.error ?? JSON.stringify(data);
        throw new Error(msg || 'server_error');
      }

      console.log('[journal] success', data);
      if (onSuccess) onSuccess(data ?? {});
      return data;
    } catch (err) {
      console.error('[journal] submit error', err);
      throw err;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('登録中...');

    const body = {
      date: formData.date,
      debit_name: formData.debit_name,
      credit_name: formData.credit_name,
      amount: formData.amount,
      description: formData.description,
    };
    try {
      const data = await submitJournal(body, () => {
        // 成功時の処理: 残高再取得等
        fetchBalances();
      });
      setMessage('✅ 登録成功！仕訳ID: ' + (data?.journalId ?? ''));
      setFormData(prev => ({ ...prev, amount: '', description: '' })); 
      // 成功したら集計データを再ロード
    } catch (err) {
      console.error('[handleSubmit] error', err);
      const msg = err instanceof Error ? err.message : String(err);
      setMessage('❌ 登録失敗: ' + msg);
    }
  };

  // safe amount formatter（コンポーネント内か共通ユーティリティに入れてください）
  const fmtAmount = (v: unknown, opts?: { minFraction?: number; maxFraction?: number }) => {
    // null/undefined -> 0 として扱う（必要なら '-' に変える）
    if (v === null || v === undefined) return '0';

    // 数字や数値文字列を正規化して parseFloat へ
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '0';
      return v.toLocaleString(undefined, { minimumFractionDigits: opts?.minFraction ?? 0, maximumFractionDigits: opts?.maxFraction ?? 2 });
    }

    // 文字列の場合、数字以外の全角スペースや改行などを除去してから数値化
    if (typeof v === 'string') {
      const normalized = v.replace(/[^\d\-.,eE]/g, '').replace(/,/g, '');
      const n = parseFloat(normalized);
      if (!Number.isFinite(n)) return '0';
      return n.toLocaleString(undefined, { minimumFractionDigits: opts?.minFraction ?? 0, maximumFractionDigits: opts?.maxFraction ?? 2 });
    }

    // その他型は一律 '0'
    return '0';
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
              <td style={tableCellStyle}>{fmtAmount(item.total_debit)}</td>
              <td style={tableCellStyle}>{fmtAmount(item.total_credit)}</td>
              <td style={tableCellStyle as React.CSSProperties & { color: string }}>
                {fmtAmount(item.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default JournalEntry;