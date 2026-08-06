# syntax=docker/dockerfile:1.7

FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM migrate/migrate:v4.19.0 AS migrate

FROM alpine:3.23

RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app

COPY --from=builder /out/server /usr/local/bin/server
COPY --from=migrate /usr/local/bin/migrate /usr/local/bin/migrate
COPY internal/db/migrations /app/migrations

USER app
EXPOSE 8080

CMD ["/usr/local/bin/server"]
