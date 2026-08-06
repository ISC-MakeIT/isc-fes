-include ./backend/.env

export DATABASE_URL

.PHONY: db-up db-down dev-api migrate sqlc gen-api db-reset install-web dev-web push-backend-image
db-up:
	docker compose up -d
db-down:
	docker compose down
dev-api:
	cd backend && go tool air
migrate:
	cd backend && migrate -path internal/db/migrations -database "$(DATABASE_URL)" up
sqlc:
	cd backend && go tool sqlc generate
db-reset:
	docker compose down -v && docker compose up -d
gen-api:
	cd backend && go tool oapi-codegen -config oapi.yaml ../openapi.yaml > internal/api/gen.go
	cd frontend && \
		pnpx openapi-typescript ../openapi.yaml -o ./src/shared/api/schema.d.ts && \
		pnpm run fmt ./src/shared/api/schema.d.ts

install-web:
	cd frontend && pnpm i
dev-web:
	cd frontend && pnpm run dev

push-backend-image:
	bash scripts/push-backend-image.sh
