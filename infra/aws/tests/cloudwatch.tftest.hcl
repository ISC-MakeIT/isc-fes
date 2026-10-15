# Mock providerのみを使用し、実AWSへ接続・変更しない。
mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }

  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-northeast-1a"] }
  }

  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }

  mock_data "aws_iam_policy_document" {
    defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
  }
}

mock_provider "aws" {
  alias = "us_east_1"
}

# 元々InstanceIdだけの系列に drop_original_metrics を付けると、Agentが何も送信しなくなる（2026年10月15日に発生）。
run "instance_only_metrics_are_sent" {
  command = plan

  assert {
    condition = alltrue([
      for plugin in ["mem", "swap"] : !contains(keys(local.cloudwatch_agent_config.metrics.metrics_collected[plugin]), "drop_original_metrics")
    ])
    error_message = "mem・swapにdrop_original_metricsを付けると、メモリのメトリクスが送信されずアラームが鳴り続けます。"
  }
}

run "mention_users" {
  command = plan
  variables {
    discord_mention_user_ids = ["123456789012345678", "987654321098765432", "123456789012345678"]
  }
  assert {
    condition     = jsondecode(aws_lambda_function.discord_notifier[0].environment[0].variables["DISCORD_MENTION_USER_IDS"]) == ["123456789012345678", "987654321098765432"]
    error_message = "User ID配列を文字列のまま重複除去してLambdaへ渡す必要があります。"
  }
}

run "invalid_mention_id" {
  command = plan
  variables {
    discord_mention_user_ids = ["@everyone", null, "18446744073709551616"]
  }
  expect_failures = [var.discord_mention_user_ids]
}

run "end_monitoring_period" {
  command = plan
  variables {
    api_server_instance_type = "t4g.micro"
    cloudwatch_enabled       = false
  }

  assert {
    condition = (
      aws_instance.api_server.instance_type == "t4g.micro" && length(aws_cloudwatch_metric_alarm.api_server) == 0 && length(aws_cloudwatch_dashboard.api_server) == 0 &&
      length(aws_lambda_function.discord_notifier) == 0 && length(aws_sns_topic.api_server_alerts) == 0
    )
    error_message = "期間終了後はmicroに戻して監視・通知リソースを削除する必要があります。"
  }

  assert {
    condition     = strcontains(aws_ssm_association.api_server_cloudwatch_agent.parameters.commands, "systemctl disable --now amazon-cloudwatch-agent") && !strcontains(aws_ssm_association.api_server_cloudwatch_agent.parameters.commands, "fetch-config")
    error_message = "Association削除だけではAgentが残るため、停止・自動起動無効化が必要です。"
  }
}

run "unsupported_instance_type" {
  command = plan
  variables {
    api_server_instance_type = "t3.medium"
  }
  expect_failures = [var.api_server_instance_type]
}
