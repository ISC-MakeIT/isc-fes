include ./backend/.env.example
export

.PHONY: db-up db-down dev-api migrate sqlc gen-api db-reset
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
