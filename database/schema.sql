-- 会計システムのデータベーススキーマ

-- 勘定科目テーブル
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  -- account_type の種類:
  --   'asset'     : 資産（借方がホームポジション）
  --   'liability' : 負債（貸方がホームポジション）
  --   'revenue'   : 収益（貸方がホームポジション）
  --   'expense'   : 費用（借方がホームポジション）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初期勘定科目データ
INSERT INTO accounts (name, account_type) VALUES
  ('現金', 'asset'),
  ('売掛金', 'asset'),
  ('買掛金', 'liability'),
  ('売上', 'revenue'),
  ('消耗品費', 'expense'),
  ('給料手当', 'expense')
ON CONFLICT (name) DO UPDATE SET account_type = EXCLUDED.account_type;

-- 仕訳帳テーブル
CREATE TABLE IF NOT EXISTS journals (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  debit_account_id INT NOT NULL REFERENCES accounts(id),
  credit_account_id INT NOT NULL REFERENCES accounts(id),
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(date);
CREATE INDEX IF NOT EXISTS idx_journals_debit ON journals(debit_account_id);
CREATE INDEX IF NOT EXISTS idx_journals_credit ON journals(credit_account_id);
