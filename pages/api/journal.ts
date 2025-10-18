import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

function getDbHost() {
  const sqlConn = (process.env.SQL_CONN || 'localhost').trim();
  if (sqlConn.startsWith('/') || sqlConn.startsWith('/cloudsql')) return sqlConn;
  if (sqlConn.includes(':')) return `/cloudsql/${sqlConn}`;
  return sqlConn;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: getDbHost(),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.end();
    } catch (e: unknown) {
      console.error('pg end error', e);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { date, debit_name, credit_name, amount, description } = req.body ?? {};

  if (!date || !debit_name || !credit_name || !amount) {
    return res.status(400).json({ message: 'date, debit_name, credit_name, amount are required' });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  try {
    const result = await withClient(async (client) => {
      try {
        await client.query('BEGIN');

        // 勘定科目ID取得
        const getAccountIdQuery = 'SELECT id FROM accounts WHERE name = $1';
        const debitRes = await client.query(getAccountIdQuery, [debit_name]);
        const creditRes = await client.query(getAccountIdQuery, [credit_name]);
        if (debitRes.rows.length === 0 || creditRes.rows.length === 0) {
          await client.query('ROLLBACK');
          throw { status: 400, message: '無効な勘定科目が指定されました' };
        }
        const debitId = debitRes.rows[0].id;
        const creditId = creditRes.rows[0].id;

        // journals にヘッダを挿入（schema: posted_at, description）
        const insertJournalQ = `INSERT INTO journals (posted_at, description, created_at, updated_at)
                                VALUES ($1, $2, now(), now()) RETURNING id`;
        const jr = await client.query(insertJournalQ, [date, description ?? null]);
        const journalId = jr.rows[0].id;

        // journal_entries に借方/貸方行を挿入
        const insertEntryQ = `INSERT INTO journal_entries (journal_id, account_id, amount, position, created_at, updated_at)
                              VALUES ($1, $2, $3, $4, now(), now())`;
        await client.query(insertEntryQ, [journalId, debitId, amt, 'debit']);
        await client.query(insertEntryQ, [journalId, creditId, amt, 'credit']);

        await client.query('COMMIT');
        return { journalId };
      } catch (e: unknown) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackErr: unknown) {
          console.error('rollback error', rollbackErr);
        }
        throw e;
      }
    });

    return res.status(200).json({ message: '仕訳登録成功', journalId: result.journalId ?? result.journalId });
  } catch (err: unknown) {
    console.error('Database Error (Journal API):', err);
    if (typeof err === 'object' && err !== null) {
      const e = err as { status?: number; message?: string };
      if (typeof e.status === 'number') return res.status(e.status).json({ message: e.message ?? 'error' });
    }
    return res.status(500).json({ message: '仕訳登録中にサーバーエラーが発生しました。' });
  }
}