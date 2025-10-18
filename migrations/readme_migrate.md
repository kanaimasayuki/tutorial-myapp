実行方法（ローカル）例:

psql コマンドで実行:
psql "postgresql://$DB_USER:$DB_PASS@$SQL_CONN/$DB_NAME" -f migrations/002_add_home_position_to_accounts.sql
例（.env.local を設定している前提）:
export DB_USER=postgres; export DB_PASS=secret; export SQL_CONN=localhost; export DB_NAME=mydb
psql "postgresql://$DB_USER:$DB_PASS@$SQL_CONN/$DB_NAME" -f migrations/002_add_home_position_to_accounts.sql