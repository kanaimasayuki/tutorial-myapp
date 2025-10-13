import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

// DB接続設定（環境変数を使用）
const dbConfig = {
  host: `/cloudsql/${process.env.SQL_CONN}`, 
  user: process.env.DB_USER,
  password: process.env.DB_PASS, // Secret Managerから注入
  database: process.env.DB_NAME,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { date, debit_name, credit_name, amount, description } = req.body;
  
  const client = new Client(dbConfig);

  try {
    await client.connect();

    // 1. 勘定科目IDを取得
    const getAccountIdQuery = 'SELECT id FROM accounts WHERE name = $1';
    const debitResult = await client.query(getAccountIdQuery, [debit_name]);
    const creditResult = await client.query(getAccountIdQuery, [credit_name]);

    if (debitResult.rows.length === 0 || creditResult.rows.length === 0) {
      return res.status(400).json({ message: '無効な勘定科目が指定されました。DB設定を確認してください。' });
    }

    const debitId = debitResult.rows[0].id;
    const creditId = creditResult.rows[0].id;

    // 2. 仕訳を登録
    const insertQuery = `
      INSERT INTO journals (date, debit_account_id, credit_account_id, amount, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [date, debitId, creditId, amount, description]);

    res.status(200).json({ 
        message: '仕訳登録成功',
        journal: result.rows[0] 
    });

  } catch (error) {
    console.error('Database Error (Journal API):', error);
    res.status(500).json({ message: '仕訳登録中にサーバーエラーが発生しました。' });
  } finally {
    await client.end();
  }
}