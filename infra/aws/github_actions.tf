locals {
  github_actions_repository_subject = "ISC-MakeIT@40373318/isc-fes@1308638739"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_actions_main_assume_role" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${local.github_actions_repository_subject}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_ecr_push" {
  name               = "isc-fes-github-actions-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.github_actions_main_assume_role.json
}

data "aws_iam_policy_document" "github_actions_ecr_push" {
  statement {
    sid       = "GetECRAuthorizationToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushBackendImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }
}

resource "aws_iam_role_policy" "github_actions_ecr_push" {
  name   = "push-backend-image"
  role   = aws_iam_role.github_actions_ecr_push.id
  policy = data.aws_iam_policy_document.github_actions_ecr_push.json
}

output "github_actions_ecr_push_role_arn" {
  description = "GitHub ActionsがBackend ImageをECRへpushするために引き受けるIAM Role ARN"
  value       = aws_iam_role.github_actions_ecr_push.arn
}

resource "aws_iam_role" "github_actions_backend_deploy" {
  name               = "isc-fes-github-actions-backend-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_main_assume_role.json
}

data "aws_iam_policy_document" "github_actions_backend_deploy" {
  statement {
    sid       = "DiscoverAPIServer"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid       = "CheckBackendImage"
    actions   = ["ecr:DescribeImages"]
    resources = [aws_ecr_repository.backend.arn]
  }

  statement {
    sid     = "DeployBackendWithRunCommand"
    actions = ["ssm:SendCommand"]
    resources = [
      aws_instance.api_server.arn,
      "arn:aws:ssm:ap-northeast-1::document/AWS-RunShellScript",
    ]
  }

  # GetCommandInvocationはResourceレベルの権限設定に対応していない。
  statement {
    sid       = "ReadBackendDeploymentResult"
    actions   = ["ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_backend_deploy" {
  name   = "deploy-backend"
  role   = aws_iam_role.github_actions_backend_deploy.id
  policy = data.aws_iam_policy_document.github_actions_backend_deploy.json
}

output "github_actions_backend_deploy_role_arn" {
  description = "GitHub ActionsがBackendをEC2へdeployするために引き受けるIAM Role ARN"
  value       = aws_iam_role.github_actions_backend_deploy.arn
}
