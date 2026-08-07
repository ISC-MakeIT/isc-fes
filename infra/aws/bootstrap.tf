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

locals {
  docker_compose_version       = "v5.4.0"
  docker_compose_arm64_sha256  = "fc5d1371f1ec7987e703da94ede49af3fbfb240b83f22991a98511de7bc4b93b"
  docker_compose_download_base = "https://github.com/docker/compose/releases/download"
}

resource "aws_ssm_association" "api_server_docker_compose" {
  name             = "AWS-RunShellScript"
  association_name = "isc-fes-api-server-docker-compose"

  parameters = {
    commands = join("\n", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "if docker compose version >/dev/null 2>&1; then docker compose version; exit 0; fi",
      "command -v curl >/dev/null",
      "install -d -o root -g root -m 0755 /usr/local/lib/docker/cli-plugins",
      "compose_tmp=\"$(mktemp)\"",
      "trap 'rm -f \"$compose_tmp\"' EXIT",
      "curl --fail --silent --show-error --location \"${local.docker_compose_download_base}/${local.docker_compose_version}/docker-compose-linux-aarch64\" --output \"$compose_tmp\"",
      "echo \"${local.docker_compose_arm64_sha256}  $compose_tmp\" | sha256sum --check --status",
      "install -o root -g root -m 0755 \"$compose_tmp\" /usr/local/lib/docker/cli-plugins/docker-compose",
      "docker compose version",
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
    Name = "isc-fes-api-server-docker-compose"
  }

  depends_on = [aws_ssm_association.api_server_docker]
}
