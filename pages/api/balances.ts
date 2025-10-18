import type { NextApiRequest, NextApiResponse } from 'next';
import { Client, types } from 'pg';

// PostgreSQL の NUMERIC を number に変換している場合は既にある想定
types.setTypeParser(1700, (val: string | null) => (val === null ? null : parseFloat(val)));

function getDbHost(): string {
  const sqlConn = process.env.SQL_CONN?.trim() ?? 'localhost';
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
    // 接続試行で長時間ハングしないようにタイムアウトを設定（ミリ秒）
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('[balances] connecting to DB host=%s user=%s db=%s', client.host, client.user, client.database);
    await client.connect();
    console.log('[balances] db connected');
    return await fn(client);
  } catch (e) {
    console.error('[balances] DB connect/query error', e);
    throw e;
  } finally {
    try {
      await client.end();
      console.log('[balances] db disconnected');
    } catch (e) {
      console.error('[balances] db end error', e);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[balances] request received', req.method, req.url);
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const rows = await withClient(async (client) => {
      const q = `
        SELECT
          a.id AS account_id,
          a.code,
          a.name AS account_name,
          a.type,
          a.home_position,
          COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END), 0) AS debit_total,
          COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END), 0) AS credit_total,
          -- raw_balance: debit - credit (positive => debit balance, negative => credit balance)
          (COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
           - COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
          ) AS raw_balance,
          CASE
            WHEN COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
                 >= COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
            THEN 'debit' ELSE 'credit' END AS balance_position,
          -- home_signed_balance: 科目の home_position 基準で符号付けした残高（常に正の値がホーム側、負は反対側）
          CASE
            WHEN a.home_position = 'debit' THEN
              (COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
               - COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0))
            ELSE
              (COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
               - COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0))
          END AS home_signed_balance
        FROM accounts a
        LEFT JOIN journal_entries je ON je.account_id = a.id
        GROUP BY a.id, a.code, a.name, a.type, a.home_position
        ORDER BY a.code NULLS LAST, a.id;
      `;
      console.log('[balances] running query');
      const r = await client.query(q);
      console.log('[balances] query returned rows count=', Array.isArray(r.rows) ? r.rows.length : 'unknown');
      // 既存のマッピング処理をここに置く
      return r.rows.map((row: any) => ({
        ...row,
        debit_total: row.debit_total === null ? 0 : Number(row.debit_total),
        credit_total: row.credit_total === null ? 0 : Number(row.credit_total),
        raw_balance: row.raw_balance === null ? 0 : Number(row.raw_balance),
        home_signed_balance: row.home_signed_balance === null ? 0 : Number(row.home_signed_balance),
      }));
    });

    return res.status(200).json(rows);
  } catch (err) {
    console.error('[balances] handler error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}