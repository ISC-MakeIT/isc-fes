#!/usr/bin/env bash
set -euo pipefail

readonly aws_region="ap-northeast-1"
readonly runtime_env_parameter_name="/isc-fes/prod/runtime-env"
readonly max_poll_attempts=120

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

for required_command in aws git jq terraform; do
  if ! command -v "$required_command" >/dev/null; then
    echo "必要なコマンドがありません: ${required_command}" >&2
    exit 1
  fi
done

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Gitの作業ツリーに未コミットの変更があります。コミットしてから再実行してください。" >&2
  exit 1
fi

repository_url="$(terraform -chdir=infra/aws output -raw backend_repository_url)"
instance_id="$(terraform -chdir=infra/aws output -raw api_server_instance_id)"
commit_sha="$(git rev-parse HEAD)"
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
  >/dev/null 2>&1; then
  echo "デプロイ対象のImageがECRにありません: ${image_uri}" >&2
  echo "先にmake push-backend-imageを実行してください。" >&2
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
  'install -o root -g root -m 0600 /opt/isc-fes/.env.next /opt/isc-fes/.env'
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env -f /opt/isc-fes/compose.yaml pull"
  "BACKEND_IMAGE=\"$image_uri\" docker compose --env-file /opt/isc-fes/.env -f /opt/isc-fes/compose.yaml up -d --wait --wait-timeout 300 --remove-orphans"
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
for ((poll_attempt = 1; poll_attempt <= max_poll_attempts; poll_attempt++)); do
  status="$(
    aws ssm get-command-invocation \
      --region "$aws_region" \
      --command-id "$command_id" \
      --instance-id "$instance_id" \
      --query Status \
      --output text \
      2>/dev/null || true
  )"

  case "$status" in
    Success | Cancelled | TimedOut | Failed | Cancelling)
      break
      ;;
  esac

  sleep 5
done

standard_output="$(
  aws ssm get-command-invocation \
    --region "$aws_region" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query StandardOutputContent \
    --output text \
    2>/dev/null || true
)"
standard_error="$(
  aws ssm get-command-invocation \
    --region "$aws_region" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query StandardErrorContent \
    --output text \
    2>/dev/null || true
)"

if [[ -n "$standard_output" && "$standard_output" != "None" ]]; then
  printf '%s\n' "$standard_output"
fi
if [[ -n "$standard_error" && "$standard_error" != "None" ]]; then
  printf '%s\n' "$standard_error" >&2
fi

if [[ "$status" != "Success" ]]; then
  echo "Backendのデプロイに失敗しました。Status: ${status}" >&2
  exit 1
fi

echo "Backendのデプロイが完了しました: ${image_uri}"
