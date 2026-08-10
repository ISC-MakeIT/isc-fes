#!/usr/bin/env bash
set -euo pipefail

readonly aws_region="${DEPLOY_AWS_REGION:-ap-northeast-1}"
readonly runtime_env_parameter_name="${DEPLOY_RUNTIME_ENV_PARAMETER_NAME:-/isc-fes/prod/runtime-env}"
readonly max_poll_attempts=120
readonly max_invocation_lookup_failures=5

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

required_commands=(aws git jq)
if [[ -z "${DEPLOY_BACKEND_REPOSITORY_URL:-}" || -z "${DEPLOY_API_SERVER_INSTANCE_ID:-}" ]]; then
  required_commands+=(terraform)
fi

for required_command in "${required_commands[@]}"; do
  if ! command -v "$required_command" >/dev/null; then
    echo "必要なコマンドがありません: ${required_command}" >&2
    exit 1
  fi
done

aws_error_file="$(mktemp)"
readonly aws_error_file
trap 'rm -f "$aws_error_file"' EXIT

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Gitの作業ツリーに未コミットの変更があります。コミットしてから再実行してください。" >&2
  exit 1
fi

repository_url="${DEPLOY_BACKEND_REPOSITORY_URL:-}"
if [[ -z "$repository_url" ]]; then
  repository_url="$(terraform -chdir=infra/aws output -raw backend_repository_url)"
fi

instance_id="${DEPLOY_API_SERVER_INSTANCE_ID:-}"
if [[ -z "$instance_id" ]]; then
  instance_id="$(terraform -chdir=infra/aws output -raw api_server_instance_id)"
fi

commit_sha="${DEPLOY_COMMIT_SHA:-$(git rev-parse HEAD)}"
image_tag="sha-${commit_sha}"
image_uri="${repository_url}:${image_tag}"
registry="${repository_url%%/*}"
repository_name="${repository_url#*/}"
repository_account_id="${registry%%.*}"

if [[ ! "$instance_id" =~ ^i-[0-9a-f]+$ ]]; then
  echo "EC2 Instance IDが不正です: ${instance_id}" >&2
  exit 1
fi

if [[ ! "$image_uri" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-zA-Z0-9._/-]+:sha-[0-9a-f]{40}$ ]]; then
  echo "Backend image URIが不正です: ${image_uri}" >&2
  exit 1
fi

caller_account_id="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$caller_account_id" != "$repository_account_id" ]]; then
  echo "AWSの認証先がECRのアカウントと一致しません。" >&2
  echo "認証中: ${caller_account_id} / ECR: ${repository_account_id}" >&2
  exit 1
fi

if ! aws ecr describe-images \
  --region "$aws_region" \
  --repository-name "$repository_name" \
  --image-ids "imageTag=${image_tag}" \
  >/dev/null 2>"$aws_error_file"; then
  ecr_error="$(<"$aws_error_file")"
  if [[ "$ecr_error" == *"ImageNotFoundException"* ]]; then
    echo "デプロイ対象のImageがECRにありません: ${image_uri}" >&2
    echo "先にmake push-backend-imageを実行してください。" >&2
  else
    echo "ECRのImage確認に失敗しました。" >&2
    printf '%s\n' "${ecr_error:-AWS CLIからエラー内容が返されませんでした。}" >&2
  fi
  exit 1
fi

remote_commands=(
  '#!/usr/bin/env bash'
  'set -euo pipefail'
  'cd /opt/isc-fes'
  'exec 9>/opt/isc-fes/deploy.lock'
  'flock -n 9 || { echo "別のデプロイが実行中です。" >&2; exit 1; }'
  'umask 077'
  "trap 'rm -f /opt/isc-fes/.env.next; docker logout \"$registry\" >/dev/null 2>&1 || true' EXIT"
  "aws ssm get-parameter --region \"$aws_region\" --name \"$runtime_env_parameter_name\" --with-decryption --query Parameter.Value --output text > /opt/isc-fes/.env.next"
  'test -s /opt/isc-fes/.env.next'
  'chmod 0600 /opt/isc-fes/.env.next'
  "aws ecr get-login-password --region \"$aws_region\" | docker login --username AWS --password-stdin \"$registry\""
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env.next -f /opt/isc-fes/compose.yaml config --quiet"
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env.next -f /opt/isc-fes/compose.yaml pull"
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env.next -f /opt/isc-fes/compose.yaml run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
  '# Compose更新開始後の再試行でも同じ設定を使えるよう、事前検証後に新設定を確定する。'
  'mv -f /opt/isc-fes/.env.next /opt/isc-fes/.env'
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env -f /opt/isc-fes/compose.yaml up -d --wait --wait-timeout 300 --remove-orphans"
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env -f /opt/isc-fes/compose.yaml exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile"
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env -f /opt/isc-fes/compose.yaml ps"
)

parameters_json="$(printf '%s\n' "${remote_commands[@]}" | jq -Rs '{commands: [.]}' )"

command_id="$(
  aws ssm send-command \
    --region "$aws_region" \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --comment "deploy ${image_tag}" \
    --parameters "$parameters_json" \
    --query Command.CommandId \
    --output text
)"

echo "Backendのデプロイを開始しました: ${image_uri}"
echo "SSM Command ID: ${command_id}"

status="Pending"
terminal_status_observed=false
invocation_json=""
invocation_lookup_failures=0
for ((poll_attempt = 1; poll_attempt <= max_poll_attempts; poll_attempt++)); do
  if invocation_json="$(
    aws ssm get-command-invocation \
      --region "$aws_region" \
      --command-id "$command_id" \
      --instance-id "$instance_id" \
      --output json \
      2>"$aws_error_file"
  )"; then
    invocation_lookup_failures=0
    status="$(jq -r '.Status // empty' <<<"$invocation_json")"
    if [[ -z "$status" ]]; then
      echo "SSM Commandの状態を応答から取得できませんでした。" >&2
      exit 1
    fi
  else
    invocation_error="$(<"$aws_error_file")"
    if [[ "$invocation_error" != *"InvocationDoesNotExist"* ]]; then
      echo "SSM Commandの状態取得に失敗しました。" >&2
      printf '%s\n' "${invocation_error:-AWS CLIからエラー内容が返されませんでした。}" >&2
      exit 1
    fi

    ((invocation_lookup_failures += 1))
    if ((invocation_lookup_failures >= max_invocation_lookup_failures)); then
      echo "SSM Commandの状態を取得できませんでした。" >&2
      printf '%s\n' "$invocation_error" >&2
      exit 1
    fi
  fi

  case "$status" in
    Success | Cancelled | TimedOut | Failed)
      terminal_status_observed=true
      break
      ;;
  esac

  if ((poll_attempt < max_poll_attempts)); then
    sleep 5
  fi
done

standard_output="$(jq -r '.StandardOutputContent // empty' <<<"$invocation_json")"
standard_error="$(jq -r '.StandardErrorContent // empty' <<<"$invocation_json")"

if [[ -n "$standard_output" && "$standard_output" != "None" ]]; then
  printf '%s\n' "$standard_output"
fi
if [[ -n "$standard_error" && "$standard_error" != "None" ]]; then
  printf '%s\n' "$standard_error" >&2
fi

if [[ "$terminal_status_observed" != "true" ]]; then
  echo "ポーリング上限に達しました。SSM Commandは実行中の可能性があります。Status: ${status:-Unknown}" >&2
  echo "確認: aws ssm get-command-invocation --region ${aws_region} --command-id ${command_id} --instance-id ${instance_id}" >&2
  exit 1
fi

if [[ "$status" != "Success" ]]; then
  echo "Backendのデプロイに失敗しました。Status: ${status}" >&2
  exit 1
fi

echo "Backendのデプロイが完了しました: ${image_uri}"
