-include ./backend/.env

export DATABASE_URL

.PHONY: db-up db-down dev-api migrate sqlc gen-api db-reset install-web dev-web push-backend-image put-runtime-env deploy-backend
migrate:
	cd backend && migrate -path db/migrations -database "$(DATABASE_URL)" up
db-reset:
	docker compose down -v && docker compose up -d

push-backend-image:
	bash infra/deploy/scripts/push-backend-image.sh

put-runtime-env:
	bash infra/deploy/scripts/put-runtime-env.sh

deploy-backend:
	bash infra/deploy/scripts/deploy-backend.sh

# 生成系
.PHONY: gen generate gen-api gen-sqlc
gen generate: gen-api gen-sqlc
gen-api:
	cd backend && go tool oapi-codegen -config oapi.yaml ../openapi.yaml > routers/gen.go
	cd frontend && \
		pnpx openapi-typescript ../openapi.yaml -o ./src/shared/api/schema.d.ts && \
		pnpm run fmt ./src/shared/api/schema.d.ts
gen-sqlc:
	cd backend && go tool sqlc generate
new-migration:
	migrate create -ext sql -dir backend/db/migrations -seq ${name}	

# Install
.PHONY: i install install-backend install-frontend
i install: install-backend install-frontend
install-backend:
	cd backend && go mod download
install-frontend:
	cd frontend && pnpm i

# ローカル開発環境
# dd = dev docker
.PHONY: dd-up dd-down dd-restart dev-api dev-web
dd-up:
	docker compose up -d
dd-down:
	docker compose down
dd-restart:
	docker compose up -d --build --force-recreate
dev-api:
	cd backend && go tool air
dev-web:
	cd frontend && pnpm run dev
