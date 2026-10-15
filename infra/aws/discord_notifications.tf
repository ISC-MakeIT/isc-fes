variable "discord_mention_user_ids" {
  description = "アラームの発生・復旧通知でメンションするDiscord User IDの配列。空配列ならメンションなし。"
  type        = list(string)
  default     = []
  nullable    = false

  validation {
    condition = length(var.discord_mention_user_ids) <= 100 && alltrue([
      for id in var.discord_mention_user_ids : can(regex("^[1-9][0-9]{0,19}$", id)) && try(tonumber(id) <= 18446744073709551615, false)
    ]) && try(length(join(" ", [for id in distinct(var.discord_mention_user_ids) : "<@${id}>"])) <= 2000, false)
    error_message = "Discord User IDは正の64bit整数を文字列で指定してください。最大100件、メンション本文は合計2000文字以内です。"
  }
}

locals {
  discord_function_name  = "isc-fes-cloudwatch-discord"
  discord_parameter_name = "/isc-fes/prod/discord-webhook-url"
  discord_parameter_arn  = "arn:aws:ssm:ap-northeast-1:${data.aws_caller_identity.current.account_id}:parameter${local.discord_parameter_name}"
}

# Parameter本体・Webhook URLはTerraformで取得も保存もしない。
data "archive_file" "discord_notifier" {
  count       = var.cloudwatch_enabled ? 1 : 0
  type        = "zip"
  source_file = "${path.module}/lambda/discord_notifier.mjs"
  output_path = "${path.module}/.terraform/discord-notifier.zip"
}

resource "aws_sns_topic" "api_server_alerts" {
  count = var.cloudwatch_enabled ? 1 : 0
  name  = "isc-fes-api-server-alerts"
}

data "aws_iam_policy_document" "api_server_alerts" {
  count = var.cloudwatch_enabled ? 1 : 0

  statement {
    sid       = "CloudWatchAlarmPublish"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.api_server_alerts[0].arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:cloudwatch:ap-northeast-1:${data.aws_caller_identity.current.account_id}:alarm:isc-fes-api-server-*"]
    }
  }
}

resource "aws_sns_topic_policy" "api_server_alerts" {
  count  = var.cloudwatch_enabled ? 1 : 0
  arn    = aws_sns_topic.api_server_alerts[0].arn
  policy = data.aws_iam_policy_document.api_server_alerts[0].json
}

resource "aws_cloudwatch_log_group" "discord_notifier" {
  count             = var.cloudwatch_enabled ? 1 : 0
  name              = "/aws/lambda/${local.discord_function_name}"
  retention_in_days = 7
}

data "aws_iam_policy_document" "discord_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "discord_notifier" {
  count              = var.cloudwatch_enabled ? 1 : 0
  name               = local.discord_function_name
  assume_role_policy = data.aws_iam_policy_document.discord_assume_role.json
}

data "aws_iam_policy_document" "discord_notifier" {
  count = var.cloudwatch_enabled ? 1 : 0
  statement {
    sid       = "ReadWebhookURL"
    actions   = ["ssm:GetParameter"]
    resources = [local.discord_parameter_arn]
  }
  statement {
    sid       = "WriteFunctionLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.discord_notifier[0].arn}:*"]
  }
}

resource "aws_iam_role_policy" "discord_notifier" {
  count  = var.cloudwatch_enabled ? 1 : 0
  name   = "notify-discord"
  role   = aws_iam_role.discord_notifier[0].id
  policy = data.aws_iam_policy_document.discord_notifier[0].json
}

resource "aws_lambda_function" "discord_notifier" {
  count            = var.cloudwatch_enabled ? 1 : 0
  function_name    = local.discord_function_name
  role             = aws_iam_role.discord_notifier[0].arn
  runtime          = "nodejs24.x"
  architectures    = ["x86_64"]
  handler          = "discord_notifier.handler"
  memory_size      = 128
  timeout          = 30
  filename         = data.archive_file.discord_notifier[0].output_path
  source_code_hash = data.archive_file.discord_notifier[0].output_base64sha256

  environment {
    variables = {
      WEBHOOK_PARAMETER_NAME   = local.discord_parameter_name
      DISCORD_MENTION_USER_IDS = jsonencode(distinct(var.discord_mention_user_ids))
    }
  }

  depends_on = [aws_iam_role_policy.discord_notifier]
}

resource "aws_lambda_permission" "discord_sns" {
  count          = var.cloudwatch_enabled ? 1 : 0
  statement_id   = "AllowAlarmTopic"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.discord_notifier[0].function_name
  principal      = "sns.amazonaws.com"
  source_arn     = aws_sns_topic.api_server_alerts[0].arn
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_sns_topic_subscription" "discord" {
  count     = var.cloudwatch_enabled ? 1 : 0
  topic_arn = aws_sns_topic.api_server_alerts[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.discord_notifier[0].arn

  depends_on = [aws_lambda_permission.discord_sns]
}

output "discord_webhook_parameter_name" {
  description = "Discord Webhook URLを手動登録するSecureString Parameter名"
  value       = local.discord_parameter_name
}

output "api_server_alerts_topic_arn" {
  description = "CloudWatch AlarmのDiscord通知用SNS Topic ARN"
  value       = var.cloudwatch_enabled ? aws_sns_topic.api_server_alerts[0].arn : null
}
