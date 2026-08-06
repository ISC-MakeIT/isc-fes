resource "aws_ssm_association" "api_server_docker" {
  name             = "AWS-RunShellScript"
  association_name = "isc-fes-api-server-docker"

  parameters = {
    commands = join("\n", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "dnf install -y docker",
      "systemctl enable --now docker",
      "install -d -o root -g root -m 0755 /opt/isc-fes",
      "docker --version",
      "systemctl is-active --quiet docker",
    ])
    executionTimeout = "600"
  }

  targets {
    key    = "InstanceIds"
    values = [aws_instance.api_server.id]
  }

  max_concurrency                  = "1"
  max_errors                       = "0"
  wait_for_success_timeout_seconds = 600

  tags = {
    Name = "isc-fes-api-server-docker"
  }
}
