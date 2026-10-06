locals {
  db_backups_bucket_name = "isc-fes-db-backups-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "db_backups" {
  bucket        = local.db_backups_bucket_name
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = local.db_backups_bucket_name
  }
}

resource "aws_s3_bucket_ownership_controls" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    id     = "expire-db-backups"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    expiration {
      days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

data "aws_iam_policy_document" "db_backups_bucket" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.db_backups.arn,
      "${aws_s3_bucket.db_backups.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  policy = data.aws_iam_policy_document.db_backups_bucket.json
}

data "aws_iam_policy_document" "api_server_db_backups" {
  statement {
    sid = "WriteDBBackups"
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload",
    ]
    resources = ["${aws_s3_bucket.db_backups.arn}/backups/*"]
  }
}

resource "aws_iam_role_policy" "api_server_db_backups" {
  name   = "write-db-backups"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server_db_backups.json
}

resource "aws_iam_role" "github_actions_db_backup" {
  name               = "isc-fes-github-actions-db-backup"
  assume_role_policy = data.aws_iam_policy_document.github_actions_main_assume_role.json
}

data "aws_iam_policy_document" "github_actions_db_backup" {
  statement {
    sid       = "DiscoverAPIServer"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid     = "BackupDBWithRunCommand"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.api_server.arn,
      "arn:aws:ssm:ap-northeast-1::document/AWS-RunShellScript",
    ]
  }

  # GetCommandInvocationはResourceレベルの権限設定に対応していない。
  statement {
    sid       = "ReadDBBackupResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_db_backup" {
  name   = "backup-db"
  role   = aws_iam_role.github_actions_db_backup.id
  policy = data.aws_iam_policy_document.github_actions_db_backup.json
}

output "db_backups_bucket_name" {
  description = "本番DBバックアップを保存する非公開S3 Bucket名"
  value       = aws_s3_bucket.db_backups.id
}

output "github_actions_db_backup_role_arn" {
  description = "GitHub ActionsがSSM経由で本番DBをbackupするためのIAM Role ARN"
  value       = aws_iam_role.github_actions_db_backup.arn
}
