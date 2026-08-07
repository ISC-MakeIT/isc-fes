locals {
  api_server_compose_path   = "${path.module}/../../deploy/compose.yaml"
  api_server_compose_base64 = filebase64(local.api_server_compose_path)
  api_server_compose_sha256 = filesha256(local.api_server_compose_path)
}

resource "aws_ssm_association" "api_server_runtime_config" {
  name             = "AWS-RunShellScript"
  association_name = "isc-fes-api-server-runtime-config"

  parameters = {
    commands = join("\n", [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "umask 077",
      "install -d -o root -g root -m 0700 /opt/isc-fes",
      "env_tmp=\"$(mktemp /opt/isc-fes/.env.XXXXXX)\"",
      "compose_tmp=\"$(mktemp /opt/isc-fes/compose.yaml.XXXXXX)\"",
      "trap 'rm -f \"$env_tmp\" \"$compose_tmp\"' EXIT",
      "aws ssm get-parameter --region ap-northeast-1 --name /isc-fes/prod/runtime-env --with-decryption --query Parameter.Value --output text > \"$env_tmp\"",
      "test -s \"$env_tmp\"",
      "printf '%s' '${local.api_server_compose_base64}' | base64 --decode > \"$compose_tmp\"",
      "echo \"${local.api_server_compose_sha256}  $compose_tmp\" | sha256sum --check --status",
      "BACKEND_IMAGE=example.invalid/isc-fes/backend:validation docker compose --env-file \"$env_tmp\" -f \"$compose_tmp\" config --quiet",
      "install -o root -g root -m 0600 \"$env_tmp\" /opt/isc-fes/.env",
      "install -o root -g root -m 0644 \"$compose_tmp\" /opt/isc-fes/compose.yaml",
      "echo 'Runtime configuration installed.'",
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
    Name = "isc-fes-api-server-runtime-config"
  }

  depends_on = [
    aws_iam_role_policy.api_server_ssm_core,
    aws_ssm_association.api_server_docker_compose,
  ]
}
