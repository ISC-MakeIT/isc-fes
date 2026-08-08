terraform {
  required_version = ">= 1.11.0, < 2.0.0"

  backend "s3" {
    bucket       = "isc-fes-terraform-state-970835573274"
    key          = "isc-fes/aws/terraform.tfstate"
    region       = "ap-northeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0, < 7.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      Project   = "isc-fes"
      ManagedBy = "Terraform"
    }
  }
}

# CloudFrontに設定するACM Certificateはus-east-1で発行する必要がある。
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "isc-fes"
      ManagedBy = "Terraform"
    }
  }
}

output "aws_account_id" {
  description = "Terraformで管理するAWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

resource "aws_ecr_repository" "backend" {
  name                 = "isc-fes/backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the latest 30 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

output "backend_repository_url" {
  description = "BackendのDocker imageをpushするECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}
