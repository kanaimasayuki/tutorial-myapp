-- accounts テーブルに home_position を追加（既存行は type に応じて初期値を設定）
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS home_position VARCHAR(6)
    NOT NULL
    DEFAULT 'debit' CHECK (home_position IN ('debit','credit'));

-- 既存データを更新（収益・負債・資本は通常 credit、それ以外は debit とする）
UPDATE accounts
SET home_position =
  CASE
    WHEN name IN ('revenue','income','liability','equity') THEN 'credit'
    ELSE 'debit'
  END
WHERE home_position IS NULL OR home_position = '';

-- 3) 制約付与（値の検証とNOT NULL化）
ALTER TABLE accounts
  ALTER COLUMN home_position SET NOT NULL;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_home_position_check
    CHECK (home_position IN ('debit','credit'));

COMMIT;