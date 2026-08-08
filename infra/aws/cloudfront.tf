locals {
  store_images_origin_id = "${aws_s3_bucket.store_images.id}-origin"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_origin_access_control" "store_images" {
  name                              = "isc-fes-store-images"
  description                       = "Allow CloudFront to read private store images from S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "store_images" {
  comment         = "isc-fes store images"
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.store_images.bucket_regional_domain_name
    origin_id                = local.store_images_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.store_images.id

    s3_origin_config {
      origin_access_identity = ""
    }
  }

  default_cache_behavior {
    target_origin_id       = local.store_images_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "isc-fes-store-images"
  }
}

output "store_images_cloudfront_distribution_id" {
  description = "店舗画像を配信するCloudFront Distribution ID"
  value       = aws_cloudfront_distribution.store_images.id
}

output "store_images_cloudfront_base_url" {
  description = "DNS設定前に店舗画像URLとして使用するCloudFront標準URL"
  value       = "https://${aws_cloudfront_distribution.store_images.domain_name}"
}
