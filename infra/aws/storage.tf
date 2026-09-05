data "aws_caller_identity" "current" {}

locals {
  store_images_bucket_name = "isc-fes-images-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "store_images" {
  bucket        = local.store_images_bucket_name
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = local.store_images_bucket_name
  }
}

resource "aws_s3_bucket_ownership_controls" "store_images" {
  bucket = aws_s3_bucket.store_images.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "store_images" {
  bucket = aws_s3_bucket.store_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "store_images" {
  bucket = aws_s3_bucket.store_images.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "store_images" {
  bucket = aws_s3_bucket.store_images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "store_images" {
  bucket = aws_s3_bucket.store_images.id

  rule {
    id     = "cleanup-old-data"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.store_images]
}

data "aws_iam_policy_document" "store_images_bucket" {
  statement {
    sid    = "AllowCloudFrontReadImages"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = ["s3:GetObject"]
    resources = [
      "${aws_s3_bucket.store_images.arn}/images/*",
      # 旧形式の画像を移行期間中も配信する。
      "${aws_s3_bucket.store_images.arn}/stores/*",
      "${aws_s3_bucket.store_images.arn}/menus/*",
    ]

    condition {
      test     = "ArnEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.store_images.arn]
    }
  }

  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.store_images.arn,
      "${aws_s3_bucket.store_images.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "store_images" {
  bucket = aws_s3_bucket.store_images.id
  policy = data.aws_iam_policy_document.store_images_bucket.json
}

data "aws_iam_policy_document" "api_server_store_images" {
  statement {
    sid = "ManageImages"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${aws_s3_bucket.store_images.arn}/images/*"]
  }

  statement {
    sid = "ReadAndDeleteLegacyEntityImages"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
    ]
    resources = [
      "${aws_s3_bucket.store_images.arn}/stores/*",
      "${aws_s3_bucket.store_images.arn}/menus/*",
    ]
  }
}

resource "aws_iam_role_policy" "api_server_store_images" {
  name   = "manage-store-images"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server_store_images.json
}

output "store_images_bucket_name" {
  description = "店舗画像を保存する非公開S3 Bucket名"
  value       = aws_s3_bucket.store_images.id
}
