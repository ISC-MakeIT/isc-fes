locals {
  store_images_custom_domain = "img.fes.iwasaki.ac.jp"
}

resource "aws_acm_certificate" "store_images" {
  provider          = aws.us_east_1
  domain_name       = local.store_images_custom_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = local.store_images_custom_domain
  }
}

output "store_images_acm_certificate_arn" {
  description = "CloudFrontへ後から設定する店舗画像ドメインのACM Certificate ARN"
  value       = aws_acm_certificate.store_images.arn
}

output "store_images_acm_dns_validation_records" {
  description = "学校側DNSへ設定を依頼するACM検証用CNAME"
  value = {
    for option in aws_acm_certificate.store_images.domain_validation_options : option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}
