This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



# **📊 SaaS会計Webアプリ (簡易仕訳システム)**

本プロジェクトは、Next.js、Google Cloudのサーバーレス技術、およびGitHub Actionsの\*\*Workload Identity連携 (WIF)\*\*を組み合わせて構築された、シンプルな仕訳入力・残高集計アプリケーションです。

## **🌐 アーキテクチャと使用技術**

本プロジェクトのコアバリューは、「共通機能のBaaSへの委譲」と「開発・デプロイの完全自動化」です。

| コンポーネント | GCP / Firebase サービス | 役割 |
| :---- | :---- | :---- |
| **フロントエンド** (UI) | **Firebase Hosting** | Next.jsのWeb UI公開と高速配信。 |
| **バックエンド** (API) | **Cloud Run** | 仕訳登録・集計ロジック実行（サーバーレスコンテナ）。 |
| **データベース** (DB) | **Cloud SQL (PostgreSQL)** | 会計データの格納。Unixソケット接続を使用。 |
| **自動デプロイ** (CI/CD) | **GitHub Actions** / **Cloud Build** | コードプッシュ時の自動ビルド、デプロイ、公開をトリガー。 |
| **セキュリティ** | **Secret Manager** / **WIF** | DBパスワードの安全な管理と、GitHubからの認証（WIF）。 |

## **🛠️ 開発環境のセットアップ (新規環境)**

新しい環境で開発を開始する際は、以下の手順が必要です。

### **1\. GCPリソースの作成とSecretの登録**

以下の設定でGCPリソースを作成してください。

| リソース | ID / 推奨値 | 備考 |
| :---- | :---- | :---- |
| **Cloud SQL (PostgreSQL)** | tutorial-myapp-database-setting | リージョンは asia-northeast1 などに統一。 |
| **DBユーザー名** | app\_user | アプリケーションが接続する専用ユーザー。 |
| **DB名** | account\_db | アプリケーション用データベース。 |
| **Secret Manager** | DB\_PASSWORD | DBユーザー(app\_user)の**パスワード**を格納。 |

### **2\. Workload Identity連携 (WIF) の設定**

本プロジェクトのCI/CDはWIFに依存しています。以下のリポジトリ情報でWIF設定を完了してください。

| 設定項目 | 値 |
| :---- | :---- |
| **GitHubリポジトリ** | kanaimasayuki/tutorial-myapp |
| **サービスアカウント** | github-deployer@tutorial-474813.iam.gserviceaccount.com |
| **Secrets** | GCP\_PROJECT\_ID, GCP\_REGION, GCP\_SERVICE\_ACCOUNT, GCP\_WORKLOAD\_IDENTITY\_PROVIDER |

### **3\. 初期データベーススキーマの適用**

Cloud ShellからPostgreSQLに接続し、初期スキーマを作成します。

\# 環境変数を設定（Cloud Shellで毎回実行）  
export PROJECT\_ID="tutorial-474813"  
export DB\_USER="app\_user"  
export DB\_NAME="account\_db"  
export INSTANCE\_ID="tutorial-myapp-database-setting"

\# 接続（パスワードは手動入力）  
gcloud sql connect ${INSTANCE\_ID} \--user=${DB\_USER} \--database=${DB\_NAME}

\# 接続後、db/migrations/0001\_initial\_schema.sql の内容を実行し、\\q で終了。

## **💻 開発・デプロイフロー**

### **1\. ローカル開発**

UIの確認とデバッグはローカルで行います。（DB接続エラーは正常です）

npm install  
npm run dev

### **2\. コード変更の公開 (自動CI/CD)**

コード（API、UI、DBマイグレーション）を修正した後、以下のワンコマンドで自動デプロイが開始されます。

1. git add .  
2. git commit \-m "feat: adding new functionality"  
3. **git push origin main**

GitHub Actionsがトリガーされ、ビルド、Artifact Registryへのプッシュ、Cloud Runへのデプロイ、Firebase Hostingへの公開がすべて自動で実行されます。

### **3\. 公開URL**

CI/CDが成功した後、アプリケーションは以下のURLで公開されます。

**Hosting URL**: https://\[YOUR\_PROJECT\_ID\].web.app



初期データベーススキーマの作成
DB接続後、仕訳に必要なテーブルと初期データを設定します。

```
# 接続コマンド (Cloud Shellで実行)
gcloud sql connect tutorial-myapp-database-setting --user=app_user --database=account_db

# 接続後、以下のSQLを実行:
-- 1. 勘定科目（マスタ）テーブルの作成
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- 2. 仕訳トランザクション（ジャーナル）テーブルの作成
CREATE TABLE IF NOT EXISTS journals (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    debit_account_id INTEGER REFERENCES accounts(id) NOT NULL,
    credit_account_id INTEGER REFERENCES accounts(id) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT
);

-- 3. 初期データの投入 (アプリケーションのプルダウンで使用する科目)
INSERT INTO accounts (name) VALUES 
    ('現金'), 
    ('売上'), 
    ('買掛金'), 
    ('売掛金'), 
    ('消耗品費'), 
    ('給料手当') 
ON CONFLICT (name) DO NOTHING;

\q
```

