#!/usr/bin/env bash
set -euo pipefail

readonly aws_region="ap-northeast-1"
readonly parameter_name="/isc-fes/prod/runtime-env"
readonly max_standard_parameter_bytes=4096
readonly validation_backend_image="example.invalid/isc-fes/backend:validation"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

for required_command in aws docker git terraform; do
  if ! command -v "$required_command" >/dev/null; then
    echo "必要なコマンドがありません: ${required_command}" >&2
    exit 1
  fi
done

env_file="${1:-deploy/.env}"

if [[ ! -f "$env_file" ]]; then
  echo "Runtime環境変数ファイルがありません: ${env_file}" >&2
  echo "deploy/.env.exampleをもとに作成してください。" >&2
  exit 1
fi

if [[ ! -s "$env_file" ]]; then
  echo "Runtime環境変数ファイルが空です: ${env_file}" >&2
  exit 1
fi

if git ls-files --error-unmatch "$env_file" >/dev/null 2>&1; then
  echo "Secretを含むファイルがGitで追跡されています: ${env_file}" >&2
  exit 1
fi

if ! git check-ignore --quiet "$env_file"; then
  echo "Secretを含むファイルが.gitignoreの対象ではありません: ${env_file}" >&2
  exit 1
fi

readonly required_keys=(
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB
  DATABASE_URL
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  GOOGLE_REDIRECT_URL
  SESSION_COOKIE_SECURE
  FRONTEND_URL
  CORS_ALLOWED_ORIGINS
  AWS_REGION
  S3_BUCKET
)

for key in "${required_keys[@]}"; do
  count="$(grep -c "^${key}=." "$env_file" || true)"
  if [[ "$count" -ne 1 ]]; then
    echo "${key}は値を持つ定義を1つだけ設定してください。" >&2
    exit 1
  fi
done

if grep -Eq '<[^>]+>' "$env_file"; then
  echo "Runtime環境変数ファイルに未置換の<...>プレースホルダーがあります。" >&2
  exit 1
fi

if ! grep -Fxq "AWS_REGION=${aws_region}" "$env_file"; then
  echo "AWS_REGIONには${aws_region}を設定してください。" >&2
  exit 1
fi

if ! grep -Fxq "SESSION_COOKIE_SECURE=true" "$env_file"; then
  echo "SESSION_COOKIE_SECUREには本番用のtrueを設定してください。" >&2
  exit 1
fi

file_size="$(wc -c < "$env_file" | tr -d ' ')"
if ((file_size > max_standard_parameter_bytes)); then
  echo "Runtime環境変数ファイルがParameter Store Standardの4KB制限を超えています: ${file_size} bytes" >&2
  exit 1
fi

BACKEND_IMAGE="$validation_backend_image" docker compose \
  --env-file "$env_file" \
  -f deploy/compose.yaml \
  config --quiet

aws_account_id="$(terraform -chdir=infra/aws output -raw aws_account_id)"

if [[ ! "$aws_account_id" =~ ^[0-9]{12}$ ]]; then
  echo "Terraformから取得したAWS Account IDが不正です: ${aws_account_id}" >&2
  exit 1
fi

caller_account_id="$(
  aws sts get-caller-identity \
    --query Account \
    --output text
)"

if [[ "$caller_account_id" != "$aws_account_id" ]]; then
  echo "AWSの認証先が想定するアカウントと一致しません。" >&2
  echo "認証中: ${caller_account_id} / 想定: ${aws_account_id}" >&2
  exit 1
fi

aws ssm put-parameter \
  --region "$aws_region" \
  --name "$parameter_name" \
  --description "isc-fes production runtime environment" \
  --type SecureString \
  --tier Standard \
  --value "file://${env_file}" \
  --overwrite \
  >/dev/null

parameter_version="$(
  aws ssm get-parameter \
    --region "$aws_region" \
    --name "$parameter_name" \
    --query Parameter.Version \
    --output text
)"

echo "Parameter Storeを更新しました: ${parameter_name} (version ${parameter_version})"
