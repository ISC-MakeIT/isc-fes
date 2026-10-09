#!/usr/bin/env bash
# EC2上でのみ実行する。呼出側はtimeoutで処理全体を20分に制限する。
set -euo pipefail
umask 077

readonly bucket="${1:?Backup bucket is required}"
readonly aws_region="${2:?AWS Region is required}"
readonly run_id="${3:?Run ID is required}"
readonly work_dir="${BACKUP_WORK_DIR:-/opt/isc-fes}"

if [[ ! "$bucket" =~ ^isc-fes-db-backups-[0-9]{12}$ ||
      ! "$aws_region" =~ ^[a-z0-9]+(-[a-z0-9]+)*-[0-9]+$ ||
      ! "$run_id" =~ ^[a-zA-Z0-9-]{1,80}$ ]]; then
  echo "Backup arguments are invalid." >&2
  exit 1
fi

# EC2 Instance Profileを使用し、CLIの通信・再試行も有限にする。
export AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=3 AWS_PAGER=""
stage=preflight
tmp_dir=""
db_container=""
dump_active=false
# PostgreSQLの63文字制限に合わせ、終了処理でも同じ接続名を使う。
readonly application_name="isc-fes-backup-${run_id:0:48}"

db_sql() {
  docker exec "$db_container" sh -eu -c '
    exec psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      --tuples-only --no-align --set ON_ERROR_STOP=1 --command "$1"
  ' sh "$1"
}

cleanup() {
  local exit_status=$?
  trap - EXIT
  if (( exit_status != 0 )); then
    echo "BACKUP_FAILED_STAGE=${stage}" >&2
  fi
  # docker execのクライアント終了だけではDB側の接続終了を保証できない。
  if [[ "$dump_active" == true && -n "$db_container" ]]; then
    timeout --kill-after=2s 10s docker exec "$db_container" sh -eu -c '
      exec psql --no-psqlrc --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        --set ON_ERROR_STOP=1 --command "$1"
    ' sh "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = '${application_name}' AND pid <> pg_backend_pid();" \
      >/dev/null 2>&1 || true
  fi
  if [[ -n "$tmp_dir" ]]; then
    rm -rf -- "$tmp_dir"
  fi
  exit "$exit_status"
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

for required_command in aws docker timeout flock sha256sum stat df; do
  command -v "$required_command" >/dev/null
done
test -d "$work_dir"

stage=backup-lock
exec 8>"$work_dir/backup.lock"
flock -n 8 || { echo "Another backup is running." >&2; exit 1; }
stage=deploy-lock
exec 9>"$work_dir/deploy.lock"
flock -w 300 9 || { echo "Deployment lock timed out." >&2; exit 1; }

stage=database-discovery
containers="$(docker ps --filter label=com.docker.compose.project=isc-fes \
  --filter label=com.docker.compose.service=db --format '{{.ID}}')"
if [[ ! "$containers" =~ ^[0-9a-f]{12,64}$ ]]; then
  echo "Exactly one running production DB container is required." >&2
  exit 1
fi
db_container="$containers"

stage=capacity-check
database_size="$(db_sql 'SELECT pg_database_size(current_database());')"
postgres_version="$(db_sql "SELECT current_setting('server_version_num');")"
if [[ ! "$database_size" =~ ^[0-9]+$ || ! "$postgres_version" =~ ^17[0-9]{4}$ ]]; then
  echo "Database size or PostgreSQL version is invalid (PostgreSQL 17 is required)." >&2
  exit 1
fi
available_bytes="$(df --output=avail -B1 "$work_dir" | tail -n 1 | tr -d ' ')"
if [[ ! "$available_bytes" =~ ^[0-9]+$ ]] ||
   (( available_bytes < database_size + 1073741824 )); then
  echo "Insufficient disk space: require database size plus 1 GiB." >&2
  exit 1
fi
echo "Database bytes: $database_size / Available bytes: $available_bytes"

tmp_dir="$(mktemp -d "$work_dir/.db-backup.XXXXXX")"
readonly dump_file="$tmp_dir/database.dump"
readonly manifest_file="$tmp_dir/manifest.json"
started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
object_prefix="backups/$(date -u +'%Y/%m/%d/%Y%m%dT%H%M%SZ')-${run_id}"
started_seconds=$SECONDS
stage=dump
dump_active=true
# AlpineのtimeoutをDBコンテナ内でも使用し、パスワードはコンテナ外へ出さない。
docker exec --env "PGAPPNAME=$application_name" "$db_container" sh -eu -c '
  exec timeout -s TERM -k 10 900 pg_dump --format=custom \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --lock-wait-timeout=30s
' > "$dump_file"
dump_active=false
test -s "$dump_file"
stage=archive-validation
docker exec -i "$db_container" timeout -s TERM -k 5 30 pg_restore --list \
  < "$dump_file" > /dev/null
dump_completed_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
backend_image="$(docker ps --filter label=com.docker.compose.project=isc-fes \
  --filter label=com.docker.compose.service=api --format '{{.Image}}')"
backend_image_json=null
if [[ "$backend_image" =~ ^[a-zA-Z0-9_./:@-]+$ ]]; then
  backend_image_json="\"$backend_image\""
fi
# S3転送中はmigrationを妨げない。backup.lockは処理終了まで保持する。
flock -u 9
exec 9>&-

sha256="$(sha256sum "$dump_file")"
sha256="${sha256%% *}"
size_bytes="$(stat -c %s "$dump_file")"
echo "Dump bytes: $size_bytes / Dump duration seconds: $(( SECONDS - started_seconds ))"

stage=dump-upload
aws s3 cp "$dump_file" "s3://$bucket/$object_prefix/database.dump" \
  --region "$aws_region" --sse AES256 --only-show-errors \
  --cli-connect-timeout 10 --cli-read-timeout 60

stage=manifest-upload
# 全文字列は検証済みの識別子か固定フォーマット。成功記録はdump転送後にだけ保存する。
printf '{"dump_key":"%s/database.dump","started_at":"%s","dump_completed_at":"%s","completed_at":"%s","size_bytes":%s,"sha256":"%s","postgres_version_num":%s,"database_size_bytes":%s,"run_id":"%s","backend_image":%s}\n' \
  "$object_prefix" "$started_at" "$dump_completed_at" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  "$size_bytes" "$sha256" "$postgres_version" "$database_size" "$run_id" "$backend_image_json" > "$manifest_file"
aws s3 cp "$manifest_file" "s3://$bucket/$object_prefix/manifest.json" \
  --region "$aws_region" --sse AES256 --content-type application/json --only-show-errors \
  --cli-connect-timeout 10 --cli-read-timeout 60

stage=complete
echo "Backup complete: s3://$bucket/$object_prefix/manifest.json"
