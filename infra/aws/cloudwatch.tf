variable "cloudwatch_enabled" {
  description = "負荷試験・本番期間の監視を有効化。期間終了後はfalseにしてAgent停止と監視リソース削除を行う。"
  type        = bool
  default     = true
}

locals {
  cloudwatch_namespace = "ISCFes/EC2"

  # InstanceIdだけに集約し、CPU・Device・Interface別の元の系列は送信しない。
  # CPU 5 + Memory 6 + Swap 3 + Disk 5 + Disk I/O 7 + Network 4 = 30系列。
  cloudwatch_measurements = {
    cpu    = ["cpu_usage_user", "cpu_usage_system", "cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_steal"]
    mem    = ["mem_used_percent", "mem_available", "mem_used", "mem_free", "mem_cached", "mem_buffered"]
    swap   = ["swap_used_percent", "swap_used", "swap_free"]
    disk   = ["disk_used_percent", "disk_used", "disk_free", "disk_inodes_free", "disk_inodes_used"]
    diskio = ["diskio_read_bytes", "diskio_write_bytes", "diskio_reads", "diskio_writes", "diskio_read_time", "diskio_write_time", "diskio_io_time"]
    net    = ["net_bytes_sent", "net_bytes_recv", "net_packets_sent", "net_packets_recv"]
  }

  # mem・swapは元々InstanceIdだけの系列で、集約しても同じ系列になる。
  # Agentは元と同じ集約系列を作らないため、drop_original_metricsを付けると何も送信されなくなる。
  cloudwatch_plugins_with_extra_dimensions = ["cpu", "disk", "diskio", "net"]

  cloudwatch_agent_config = {
    agent = {
      # アラームの判定期間（60秒）に合わせる。短くしても検知は早まらず、送信回数だけ増える。
      metrics_collection_interval = 60
      region                      = "ap-northeast-1"
      omit_hostname               = true
      usage_data                  = false
    }
    metrics = {
      namespace              = local.cloudwatch_namespace
      append_dimensions      = { InstanceId = "$${aws:InstanceId}" }
      aggregation_dimensions = [["InstanceId"]]
      force_flush_interval   = 60
      metrics_collected = {
        for plugin, measurements in local.cloudwatch_measurements : plugin => merge(
          { measurement = measurements },
          contains(local.cloudwatch_plugins_with_extra_dimensions, plugin) ? { drop_original_metrics = measurements } : {},
          plugin == "cpu" ? { totalcpu = true } : {},
          plugin == "disk" ? { resources = ["/"] } : {},
          # 実際のRoot DeviceとDefault RouteのInterfaceをEC2上で解決する。
          plugin == "diskio" || plugin == "net" ? { resources = ["__RESOLVE_ON_INSTANCE__"] } : {}
        )
      }
    }
  }

  cloudwatch_alarms = {
    cpu = {
      description = "CPU使用率が80%以上で3分継続、またはAgentのCPUメトリクスが欠損"
      namespace   = local.cloudwatch_namespace
      metric      = "cpu_usage_idle"
      comparison  = "LessThanOrEqualToThreshold"
      threshold   = 20
      statistic   = "Average"
      period      = 60
      evaluations = 3
      missing     = "breaching"
    }
    memory = {
      description = "メモリ使用率が85%以上で3分継続、またはAgentのメモリメトリクスが欠損"
      namespace   = local.cloudwatch_namespace
      metric      = "mem_used_percent"
      comparison  = "GreaterThanOrEqualToThreshold"
      threshold   = 85
      statistic   = "Average"
      period      = 60
      evaluations = 3
      missing     = "breaching"
    }
    disk = {
      description = "Root Disk使用率が85%以上で3分継続、またはAgentのDiskメトリクスが欠損"
      namespace   = local.cloudwatch_namespace
      metric      = "disk_used_percent"
      comparison  = "GreaterThanOrEqualToThreshold"
      threshold   = 85
      statistic   = "Maximum"
      period      = 60
      evaluations = 3
      missing     = "breaching"
    }
    cpu_credits = {
      # t4g.mediumは2 vCPU全負荷で1時間あたり差し引き96消費する。144なら抑制まで約1.5時間の猶予がある。
      description = "standardモードのCPUクレジット残量が144以下（全負荷で約1.5時間後にベースラインへ抑制）"
      namespace   = "AWS/EC2"
      metric      = "CPUCreditBalance"
      comparison  = "LessThanOrEqualToThreshold"
      threshold   = 144
      statistic   = "Minimum"
      period      = 300
      evaluations = 1
      missing     = "missing"
    }
    instance_status = {
      description = "EC2 Status Checkが2分継続で失敗"
      namespace   = "AWS/EC2"
      metric      = "StatusCheckFailed"
      comparison  = "GreaterThanOrEqualToThreshold"
      threshold   = 1
      statistic   = "Maximum"
      period      = 60
      evaluations = 2
      missing     = "missing"
    }
  }

  cloudwatch_dashboard_groups = [
    { title = "CPU (%)", namespace = local.cloudwatch_namespace, metrics = local.cloudwatch_measurements.cpu, period = 60 },
    { title = "Memory / Swap (%)", namespace = local.cloudwatch_namespace, metrics = ["mem_used_percent", "swap_used_percent"], period = 60 },
    { title = "Root Disk (%)", namespace = local.cloudwatch_namespace, metrics = ["disk_used_percent"], period = 60 },
    { title = "Root Disk I/O (bytes per interval)", namespace = local.cloudwatch_namespace, metrics = ["diskio_read_bytes", "diskio_write_bytes"], period = 60 },
    { title = "Network (bytes per interval)", namespace = local.cloudwatch_namespace, metrics = ["net_bytes_sent", "net_bytes_recv"], period = 60 },
    { title = "CPU Credits (5 min)", namespace = "AWS/EC2", metrics = ["CPUCreditBalance", "CPUCreditUsage"], period = 300 },
  ]
}

data "aws_iam_policy_document" "api_server_cloudwatch" {
  statement {
    sid       = "PublishInstanceMetrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = [local.cloudwatch_namespace]
    }
  }
}

resource "aws_iam_role_policy" "api_server_cloudwatch" {
  name   = "publish-instance-metrics"
  role   = aws_iam_role.api_server.id
  policy = data.aws_iam_policy_document.api_server_cloudwatch.json
}

resource "aws_ssm_association" "api_server_cloudwatch_agent" {
  name             = "AWS-RunShellScript"
  association_name = "isc-fes-api-server-cloudwatch-agent"

  parameters = {
    commands = templatefile("${path.module}/templates/cloudwatch-agent.sh.tftpl", {
      enabled       = var.cloudwatch_enabled
      config_base64 = base64encode(jsonencode(local.cloudwatch_agent_config))
    })
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
    Name = "isc-fes-api-server-cloudwatch-agent"
  }

  depends_on = [aws_iam_role_policy.api_server_cloudwatch]
}

resource "aws_cloudwatch_metric_alarm" "api_server" {
  for_each = var.cloudwatch_enabled ? local.cloudwatch_alarms : {}

  alarm_name          = "isc-fes-api-server-${each.key}"
  alarm_description   = each.value.description
  namespace           = each.value.namespace
  metric_name         = each.value.metric
  comparison_operator = each.value.comparison
  threshold           = each.value.threshold
  statistic           = each.value.statistic
  period              = each.value.period
  evaluation_periods  = each.value.evaluations
  datapoints_to_alarm = each.value.evaluations
  treat_missing_data  = each.value.missing

  dimensions = { InstanceId = aws_instance.api_server.id }

  alarm_actions = [aws_sns_topic.api_server_alerts[0].arn]
  ok_actions    = [aws_sns_topic.api_server_alerts[0].arn]

  # 通知先の準備が完了してからアラームを有効にする。
  depends_on = [aws_sns_topic_subscription.discord, aws_sns_topic_policy.api_server_alerts]
}

resource "aws_cloudwatch_dashboard" "api_server" {
  count          = var.cloudwatch_enabled ? 1 : 0
  dashboard_name = "isc-fes-api-server"

  dashboard_body = jsonencode({
    widgets = concat([
      {
        type   = "alarm"
        x      = 0
        y      = 0
        width  = 24
        height = 3
        properties = {
          title  = "API server alarms"
          alarms = [for alarm in aws_cloudwatch_metric_alarm.api_server : alarm.arn]
        }
      }
      ], [for index, group in local.cloudwatch_dashboard_groups : {
        type   = "metric"
        x      = (index % 2) * 12
        y      = 3 + floor(index / 2) * 6
        width  = 12
        height = 6
        properties = {
          title   = group.title
          region  = "ap-northeast-1"
          view    = "timeSeries"
          period  = group.period
          stat    = group.title == "CPU Credits (5 min)" ? "Sum" : "Average"
          metrics = [for metric in group.metrics : [group.namespace, metric, "InstanceId", aws_instance.api_server.id]]
        }
    }])
  })
}

output "api_server_cloudwatch_dashboard_url" {
  description = "APIサーバー監視Dashboard URL（監視停止時はnull）"
  value       = var.cloudwatch_enabled ? "https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=${aws_cloudwatch_dashboard.api_server[0].dashboard_name}" : null
}
