# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS builder

ARG TARGETOS
ARG TARGETARCH
ARG COMMIT_HASH=development
ARG DEPLOYED_AT

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath \
    -ldflags="-s -w -X=github.com/isc-makeit/isc-fes/backend/buildinfo.CommitHash=${COMMIT_HASH} -X=github.com/isc-makeit/isc-fes/backend/buildinfo.DeployedAt=${DEPLOYED_AT}" \
    -o /out/server ./cmd/server

FROM migrate/migrate:v4.19.0 AS migrate

FROM alpine:3.23

RUN apk add --no-cache ca-certificates \
    && addgroup -S app \
    && adduser -S -G app app

COPY --from=builder /out/server /usr/local/bin/server
COPY --from=migrate /usr/local/bin/migrate /usr/local/bin/migrate
COPY db/migrations /app/migrations

USER app
EXPOSE 8080

CMD ["/usr/local/bin/server"]
