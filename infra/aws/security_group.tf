resource "aws_security_group" "api_server" {
  name_prefix = "isc-fes-api-server-"
  description = "Controls traffic to the isc-fes API server"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "isc-fes-api-server"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_https" {
  security_group_id = aws_security_group.api_server.id
  description       = "Allow HTTPS from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "api_all_ipv4" {
  security_group_id = aws_security_group.api_server.id
  description       = "Allow outbound IPv4 traffic"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

output "api_server_security_group_id" {
  description = "APIサーバーへ割り当てるSecurity Group ID"
  value       = aws_security_group.api_server.id
}
