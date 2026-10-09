#!/usr/bin/env bash
# GitHub Actionsまたは運用者の端末からSSM経由で実行する。
set -euo pipefail

readonly aws_region="${BACKUP_AWS_REGION:-ap-northeast-1}"
readonly account_id="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
readonly run_id="${BACKUP_RUN_ID:-$(date -u +'%Y%m%dT%H%M%SZ')-$(uuidgen)}"
stage=configuration
aws_error_file=""
parameters_file=""

cleanup() {
  local exit_status=$?
  trap - EXIT
  if (( exit_status != 0 )); then
    echo "Backup failed: $stage" >&2
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      printf 'failure_stage=%s\n' "$stage" >> "$GITHUB_OUTPUT"
    fi
  fi
  [[ -z "$aws_error_file" ]] || rm -f "$aws_error_file"
  [[ -z "$parameters_file" ]] || rm -f "$parameters_file"
  exit "$exit_status"
}
trap cleanup EXIT

if [[ ! "$account_id" =~ ^[0-9]{12}$ ||
      ! "$aws_region" =~ ^[a-z0-9]+(-[a-z0-9]+)*-[0-9]+$ ||
      ! "$run_id" =~ ^[a-zA-Z0-9-]{1,80}$ ]]; then
  echo "Backup configuration is invalid." >&2
  exit 1
fi
readonly bucket="isc-fes-db-backups-${account_id}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for required_command in aws jq base64; do
  command -v "$required_command" >/dev/null
done
export AWS_PAGER="" AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=3
aws_error_file="$(mktemp)"
parameters_file="$(mktemp)"

stage=aws-account
caller_account_id="$(aws sts get-caller-identity --query Account --output text \
  --region "$aws_region" --cli-connect-timeout 10 --cli-read-timeout 30)"
if [[ "$caller_account_id" != "$account_id" ]]; then
  echo "AWS account does not match AWS_ACCOUNT_ID." >&2
  exit 1
fi

stage=instance-discovery
# Command substitutionでAWS API自体の失敗も伝播させる。
instances_json="$(aws ec2 describe-instances --region "$aws_region" \
  --filters Name=tag:Name,Values=isc-fes-api-server Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].InstanceId' --output json \
  --cli-connect-timeout 10 --cli-read-timeout 30)"
instance_id="$(jq -er 'if type == "array" and length == 1 then .[0] else error("Exactly one running API server is required") end' <<< "$instances_json")"
if [[ ! "$instance_id" =~ ^i-[0-9a-f]+$ ]]; then
  echo "Invalid EC2 instance ID." >&2
  exit 1
fi

stage=ssm-submit
script_base64="$(base64 < "$script_dir/backup-db-remote.sh" | tr -d '\r\n')"
# Remote shellへ展開する値は上で検証済み。Secretやdumpは含めない。
remote_commands=(
  '#!/usr/bin/env bash'
  'set -euo pipefail'
  'umask 077'
  'script_file="$(mktemp)"'
  'trap '\''rm -f "$script_file"'\'' EXIT'
  "printf '%s' '$script_base64' | base64 --decode > \"\$script_file\""
  "timeout --signal=TERM --kill-after=15s 1200s bash \"\$script_file\" '$bucket' '$aws_region' '$run_id'"
)
printf '%s\n' "${remote_commands[@]}" |
  jq -Rs '{commands: [.], executionTimeout: ["1230"]}' > "$parameters_file"
command_id="$(aws ssm send-command --region "$aws_region" \
  --instance-ids "$instance_id" --document-name AWS-RunShellScript \
  --timeout-seconds 120 --comment "DB backup $run_id" \
  --parameters "file://$parameters_file" --query Command.CommandId --output text \
  --cli-connect-timeout 10 --cli-read-timeout 30)"
if [[ ! "$command_id" =~ ^[0-9a-f-]{36}$ ]]; then
  echo "Invalid SSM Command ID." >&2
  exit 1
fi
echo "SSM Command ID: $command_id / Instance ID: $instance_id"

stage=ssm-wait
# 配信待ち2分＋実行20分を含め、Actionsの25分制限より先に終了する。
deadline=$(( SECONDS + 1380 ))
lookup_failures=0
status=Pending
while (( SECONDS < deadline )); do
  if invocation_json="$(aws ssm get-command-invocation --region "$aws_region" \
    --command-id "$command_id" --instance-id "$instance_id" --output json \
    --cli-connect-timeout 10 --cli-read-timeout 30 2> "$aws_error_file")"; then
    lookup_failures=0
    status="$(jq -er '.Status | select(type == "string" and length > 0)' <<< "$invocation_json")"
    case "$status" in
      Success | Cancelled | TimedOut | Failed)
        standard_output="$(jq -r '.StandardOutputContent // ""' <<< "$invocation_json")"
        standard_error="$(jq -r '.StandardErrorContent // ""' <<< "$invocation_json")"
        printf '%s\n' "$standard_output"
        printf '%s\n' "$standard_error" >&2
        if [[ "$status" == Success ]]; then
          echo "Production DB backup succeeded."
          exit 0
        fi
        stage="ssm-${status}"
        while IFS= read -r line; do
          if [[ "$line" =~ ^BACKUP_FAILED_STAGE=([a-z-]+)$ ]]; then
            stage="${BASH_REMATCH[1]}"
          fi
        done <<< "$standard_error"
        exit 1
        ;;
      Pending | InProgress | Delayed | Cancelling) ;;
      *) echo "Unexpected SSM status: $status" >&2; exit 1 ;;
    esac
  else
    aws_error="$(<"$aws_error_file")"
    if [[ "$aws_error" != *InvocationDoesNotExist* ]]; then
      printf '%s\n' "$aws_error" >&2
      exit 1
    fi
    (( lookup_failures += 1 ))
    if (( lookup_failures >= 12 )); then
      echo "SSM invocation did not become available." >&2
      exit 1
    fi
  fi
  sleep 5
done
echo "SSM wait timed out; inspect Command ID $command_id. Remote execution has its own timeout." >&2
exit 1
