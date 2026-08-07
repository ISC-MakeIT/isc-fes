locals {
  github_actions_repository = "ISC-MakeIT/isc-fes"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_actions_ecr_push_assume_role" {
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
      values   = ["repo:${local.github_actions_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_ecr_push" {
  name               = "isc-fes-github-actions-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.github_actions_ecr_push_assume_role.json
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
