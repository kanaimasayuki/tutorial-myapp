import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

// DB接続設定（環境変数を使用）
const dbConfig = {
  host: `/cloudsql/${process.env.SQL_CONN}`, 
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const client = new Client(dbConfig);

  try {
    await client.connect();

    // 全ての仕訳を集計し、勘定科目ごとの合計額を計算するSQL
    // account_typeに基づいてホームポジションからの残高を計算
    const query = `
      WITH DR_CR_AGG AS (
        -- 借方 (Debit) の合計
        SELECT debit_account_id AS account_id, SUM(amount) AS debit_total, 0 AS credit_total
        FROM journals
        GROUP BY debit_account_id
        
        UNION ALL
        
        -- 貸方 (Credit) の合計
        SELECT credit_account_id AS account_id, 0 AS debit_total, SUM(amount) AS credit_total
        FROM journals
        GROUP BY credit_account_id
      )
      SELECT 
        a.name AS account_name,
        a.account_type,
        COALESCE(SUM(dca.debit_total), 0) AS total_debit,
        COALESCE(SUM(dca.credit_total), 0) AS total_credit,
        -- ホームポジションに基づいて残高を計算
        -- 資産・費用（借方がホーム）: 借方 - 貸方
        -- 負債・収益（貸方がホーム）: 貸方 - 借方
        CASE 
          WHEN a.account_type IN ('asset', 'expense') THEN 
            COALESCE(SUM(dca.debit_total), 0) - COALESCE(SUM(dca.credit_total), 0)
          WHEN a.account_type IN ('liability', 'revenue') THEN 
            COALESCE(SUM(dca.credit_total), 0) - COALESCE(SUM(dca.debit_total), 0)
          ELSE 
            COALESCE(SUM(dca.debit_total), 0) - COALESCE(SUM(dca.credit_total), 0)
        END AS balance
      FROM accounts a
      LEFT JOIN DR_CR_AGG dca ON a.id = dca.account_id
      GROUP BY a.name, a.account_type
      ORDER BY 
        CASE a.account_type
          WHEN 'asset' THEN 1
          WHEN 'liability' THEN 2
          WHEN 'revenue' THEN 3
          WHEN 'expense' THEN 4
          ELSE 5
        END,
        a.name;
    `;
    
    const result = await client.query(query);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Database Error (Balances API):', error);
    res.status(500).json({ message: '集計データの取得中にサーバーエラーが発生しました'});
  } finally {
    await client.end();
  }
}
