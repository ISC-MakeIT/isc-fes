#!/bin/sh

set -eu

bucket="${S3_BUCKET:?S3_BUCKET is required}"
region="${AWS_DEFAULT_REGION:-ap-northeast-1}"

if awslocal s3api head-bucket \
    --bucket "${bucket}" >/dev/null 2>&1; then
  echo "S3 bucket already exists: ${bucket}"
  exit 0
fi

echo "Creating S3 bucket: ${bucket}"

awslocal s3api create-bucket \
  --bucket "${bucket}" \
  --region "${region}" \
  --create-bucket-configuration \
    "LocationConstraint=${region}"

echo "S3 bucket created: ${bucket}"