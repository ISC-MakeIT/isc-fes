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

resource "aws_iam_role_policy_attachment" "api_server_ssm" {
  role       = aws_iam_role.api_server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
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
