data "aws_iam_policy_document" "api_server_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_server" {
  name               = "isc-fes-api-server"
  assume_role_policy = data.aws_iam_policy_document.api_server_assume_role.json
}

data "aws_iam_policy_document" "api_server_ssm_core" {
  statement {
    sid = "ManageInstance"
    actions = [
      "ssm:DescribeAssociation",
      "ssm:DescribeDocument",
      "ssm:GetDeployablePatchSnapshotForInstance",
      "ssm:GetDocument",
      "ssm:GetManifest",
      "ssm:ListAssociations",
      "ssm:ListInstanceAssociations",
      "ssm:PutComplianceItems",
      "ssm:PutConfigurePackageResult",
      "ssm:PutInventory",
      "ssm:UpdateAssociationStatus",
      "ssm:UpdateInstanceAssociationStatus",
      "ssm:UpdateInstanceInformation",
    ]
    resources = ["*"]
  }

  statement {
    sid = "OpenSessionManagerChannels"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ExchangeAgentMessages"
    actions = [
      "ec2messages:AcknowledgeMessage",
      "ec2messages:DeleteMessage",
      "ec2messages:FailMessage",
      "ec2messages:GetEndpoint",
      "ec2messages:GetMessages",
      "ec2messages:SendReply",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "ReadRuntimeEnvironment"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:ap-northeast-1:${data.aws_caller_identity.current.account_id}:parameter/isc-fes/prod/runtime-env"]
  }
}

resource "aws_iam_role_policy" "api_server_ssm_core" {
  name   = "ssm-instance-core-restricted"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server_ssm_core.json
}

data "aws_iam_policy_document" "api_server_ecr_pull" {
  statement {
    sid       = "GetECRAuthorizationToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PullBackendImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }
}

resource "aws_iam_role_policy" "api_server_ecr_pull" {
  name   = "pull-backend-image"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server_ecr_pull.json
}

resource "aws_iam_instance_profile" "api_server" {
  name = "isc-fes-api-server"
  role = aws_iam_role.api_server.name
}

output "api_server_instance_profile_name" {
  description = "APIサーバーへ割り当てるIAM Instance Profile名"
  value       = aws_iam_instance_profile.api_server.name
}
