実行方法（ローカル）例:

psql コマンドで実行:
psql "postgresql://$DB_USER:$DB_PASS@$SQL_CONN/$DB_NAME" -f migrations/002_add_home_position_to_accounts.sql
例（.env.local を設定している前提）:
export DB_USER=postgres; export DB_PASS=secret; export SQL_CONN=localhost; export DB_NAME=mydb
psql "postgresql://$DB_USER:$DB_PASS@$SQL_CONN/$DB_NAME" -f migrations/002_add_home_position_to_accounts.sql


# Cloud Shell で実行（置き換えてください）
git clone https://github.com/kanaimasayuki/tutorial-app.git ~/my-accounting-saas
cd ~/my-accounting-saas

# 例: インスタンス名は Cloud SQL のインスタンスID（deploy.yml の最後の項目）
INSTANCE_NAME=tutorial-myapp-database-setting
DB_USER=postgres
DB_NAME=your_db_name

# マイグレーション実行（gcloud が Cloud Shell にプリインストールされており、
# 現在のプロジェクトが正しく設定されている前提）
gcloud sql connect $INSTANCE_NAME --user=$DB_USER --database=$DB_NAME < migrations/002_add_home_position_to_accounts.sql