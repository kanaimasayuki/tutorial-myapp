-- accounts テーブルに type カラムを追加し、許容値を制約として付与します。
-- 実行前にバックアップを取ってください。

BEGIN;

-- 1) カラム追加（既存テーブルに追加）。既存行は一旦 'asset' に設定。
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS type VARCHAR(16) DEFAULT 'asset';

-- 2) 必要なら既存データの更新（ここではデフォルト asset を維持）
UPDATE accounts
SET type = 'asset'
WHERE type IS NULL OR type = '';

-- 3) 値制約と NOT NULL 化
ALTER TABLE accounts
  ALTER COLUMN type SET NOT NULL;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('asset','liability','equity','expense','revenue'));

COMMIT;