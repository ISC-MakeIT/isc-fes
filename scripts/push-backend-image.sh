#!/usr/bin/env bash
set -euo pipefail

readonly aws_region="ap-northeast-1"

for required_command in aws docker git terraform; do
  if ! command -v "$required_command" >/dev/null; then
    echo "必要なコマンドがありません: ${required_command}" >&2
    exit 1
  fi
done

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Gitの作業ツリーに未コミットの変更があります。コミットしてから再実行してください。" >&2
  exit 1
fi

repository_url="$(terraform -chdir=infra/aws output -raw backend_repository_url)"
registry="${repository_url%%/*}"
repository_name="${repository_url#*/}"
commit_sha="$(git rev-parse HEAD)"
image_tag="sha-${commit_sha}"
image_uri="${repository_url}:${image_tag}"

caller_account_id="$(aws sts get-caller-identity --query Account --output text)"
repository_account_id="${registry%%.*}"

if [[ "$caller_account_id" != "$repository_account_id" ]]; then
  echo "AWSの認証先がECRのアカウントと一致しません。" >&2
  echo "認証中: $caller_account_id / ECR: $repository_account_id" >&2
  exit 1
fi

if aws ecr describe-images \
  --region "$aws_region" \
  --repository-name "$repository_name" \
  --image-ids "imageTag=${image_tag}" >/dev/null 2>&1; then
  echo "既にECRに存在します: ${image_uri}"
  exit 0
fi

aws ecr get-login-password --region "$aws_region" \
  | docker login --username AWS --password-stdin "$registry"

docker buildx build \
  --platform linux/arm64 \
  --provenance=false \
  --tag "$image_uri" \
  --push \
  backend

echo "ECRへpushしました: ${image_uri}"
