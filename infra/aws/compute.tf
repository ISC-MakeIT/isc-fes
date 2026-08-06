data "aws_ssm_parameter" "amazon_linux_2023_arm64_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "api_server" {
  ami                         = data.aws_ssm_parameter.amazon_linux_2023_arm64_ami.value
  instance_type               = "t4g.micro"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.api_server.id]
  iam_instance_profile        = aws_iam_instance_profile.api_server.name
  associate_public_ip_address = false

  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "isc-fes-api-server"
  }

  volume_tags = {
    Name = "isc-fes-api-server-root"
  }

  lifecycle {
    ignore_changes = [ami]
  }

  depends_on = [
    aws_iam_role_policy_attachment.api_server_ssm,
    aws_iam_role_policy.api_server_ecr_pull,
  ]
}

resource "aws_eip" "api_server" {
  domain = "vpc"

  tags = {
    Name = "isc-fes-api-server"
  }
}

resource "aws_eip_association" "api_server" {
  allocation_id = aws_eip.api_server.id
  instance_id   = aws_instance.api_server.id
}

output "api_server_instance_id" {
  description = "APIサーバーのEC2 Instance ID"
  value       = aws_instance.api_server.id
}

output "api_server_public_ip" {
  description = "学校側のDNSへ設定を依頼する固定Public IPv4 Address"
  value       = aws_eip.api_server.public_ip
}
