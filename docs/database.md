# データベースについて
データベースは PostgreSQL を使用。

## 逆引き
### 新しいマイグレーションファイルとを作りたい
```shell
migrate create -ext sql -dir internal/db/migrations -seq ${migration_name}
```
