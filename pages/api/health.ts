// pages/api/health.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

// DB接続設定（既存のAPIから流用）
const dbConfig = {
  host: `/cloudsql/${process.env.SQL_CONN}`, 
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = new Client(dbConfig);
  try {
    // 接続を試行し、成功したら終了
    await client.connect();
    await client.end();
    
    // 接続が成功したら 200 OK を返す
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    // 接続に失敗したら 503 Service Unavailable を返す
    console.error("Health Check Failed: DB Connection Error", error.message);
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
}