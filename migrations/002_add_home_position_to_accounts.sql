-- accounts テーブルに home_position を追加（既存行は type に応じて初期値を設定）
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS home_position VARCHAR(6)
    NOT NULL
    DEFAULT 'debit' CHECK (home_position IN ('debit','credit'));

-- 既存データを更新（収益・負債・資本は通常 credit、それ以外は debit とする）
UPDATE accounts
SET home_position =
  CASE
    WHEN LOWER(type) IN ('revenue','income','liability','equity') THEN 'credit'
    ELSE 'debit'
  END
WHERE home_position IS NULL OR home_position = '';

-- （オプション）制約のために NOT NULL が既に付与されている想定だが、
-- もし既存行に NULL があるなら上の UPDATE を先に実行してください。