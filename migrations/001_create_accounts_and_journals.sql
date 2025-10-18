-- accounts テーブル
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL,
  home_position VARCHAR(6) NOT NULL CHECK (home_position IN ('debit','credit')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- journals テーブル（仕訳ヘッダ）
CREATE TABLE IF NOT EXISTS journals (
  id SERIAL PRIMARY KEY,
  posted_at DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- journal_entries テーブル（仕訳行）
CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  position VARCHAR(6) NOT NULL CHECK (position IN ('debit','credit')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- サンプルデータ（初期）
INSERT INTO accounts (code, name, type, home_position)
VALUES
  ('1000', '現金', 'asset', 'debit'),
  ('4000', '売上', 'revenue', 'credit')
ON CONFLICT (code) DO NOTHING;

-- 集計用ビュー（ホームポジション基準の残高を返す例）
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id AS account_id,
  a.code,
  a.name AS account_name,
  a.home_position,
  COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount END),0) AS debit_total,
  COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount END),0) AS credit_total,
  -- raw_balance: debit - credit が正なら借方残、負なら貸方残
  COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
    - COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
    AS raw_balance,
  CASE WHEN
    COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
    >= COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
    THEN 'debit' ELSE 'credit' END AS balance_position,
  -- home_signed_balance: 科目の home_position を基準に正負を付けた値
  CASE
    WHEN a.home_position = 'debit'
      THEN (COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0)
            - COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0))
    ELSE
      (COALESCE(SUM(CASE WHEN je.position = 'credit' THEN je.amount ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN je.position = 'debit' THEN je.amount ELSE 0 END),0))
  END AS home_signed_balance
FROM accounts a
LEFT JOIN journal_entries je ON je.account_id = a.id
GROUP BY a.id, a.code, a.name, a.home_position;