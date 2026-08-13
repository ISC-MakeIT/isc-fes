# isc-fes

## Backend
### 前提
- Go
- Docker
- Make (Mac なら標準で入っている)
### 開発環境
```shell
# Docker で PostgreSQL を立てる
make db-up

# localhost:8080 で Go の API サーバーを立てる（ホットリロード付き）
make dev-api

# ./openapi.yaml から Go のコードを ./backend/routers/gen.go に生成する
make gen-api
```
