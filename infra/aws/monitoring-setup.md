# EC2・CloudWatch・Discord通知の適用手順

構成の概要は[README](README.md#cloudwatch-monitoring)を参照する。以下のコマンドはRepository Rootで実行する。
Terraformの適用はBackendのImage build/pushとは別の操作なので、`make deploy-backend`だけでは監視を導入できない。

## 1. 事前準備

AWS CLI、Terraform（1.11以上）、Bunを用意し、Account `970835573274`へ認証する。

```shell
aws login
aws sts get-caller-identity --query Account --output text
```

Instance Typeの変更でEC2が停止・再起動するため、注文受付を止めたメンテナンス時間を選び、DB Backupの最新成功を確認する。

## 2. Discord Webhookを登録

通常のText ChannelのChannel Settings → Integrations → WebhooksでWebhookを作成し、URLをコピーする。
Forum/Media ChannelやThreadのWebhookには対応しない。

```shell
bun install --frozen-lockfile
bun run infra/deploy/scripts/put-discord-webhook.ts
```

非表示の入力欄へURLを貼り付ける。ScriptはAWS AccountとURLの形式を確認してから、AWS SDKで
`/isc-fes/prod/discord-webhook-url`（SecureString、`alias/aws/ssm`）へ登録する。
Webhookの差し替えも同じScriptで行い、Lambdaは次の実行から新しいURLを使う。

## 3. 設定・Plan・Apply

`infra/aws/terraform.tfvars`で次を設定し、変更をCommitする。Webhook URLはこのファイルに含めない。

```hcl
api_server_instance_type = "t4g.medium"
cloudwatch_enabled       = true
discord_mention_user_ids = ["123456789012345678"]
```

`discord_mention_user_ids`にはDiscordのDeveloper Modeで「Copy User ID」から取得したIDを文字列で指定する。`[]`ならメンションなし。

```shell
bun run typecheck:lambda
bun run test:lambda
terraform -chdir=infra/aws init
terraform -chdir=infra/aws test
terraform -chdir=infra/aws plan -out=monitoring.tfplan
```

Planで次を確認する。

- 既存EC2のInstance Typeが`t4g.medium`へ更新され、EC2・Root EBS・Elastic IPが置換・削除されない。
- Agent用IAM PolicyとSSM Association、アラーム5本、Dashboard1つ、SNS Topic、Lambda関連Resourceが追加される。
- Webhook URLがPlanに含まれず、他のResourceに意図しない変更がない。

```shell
terraform -chdir=infra/aws apply monitoring.tfplan
curl --fail https://api.fes.iwasaki.ac.jp/health
terraform -chdir=infra/aws output -raw api_server_cloudwatch_dashboard_url
```

## 4. 通知と監視を確認

SNSへテスト用のメッセージをPublishし、Discordに`ALARM: isc-fes-api-server-notification-test`が届くことを確認する。

```shell
aws sns publish \
  --region ap-northeast-1 \
  --topic-arn "$(terraform -chdir=infra/aws output -raw api_server_alerts_topic_arn)" \
  --message '{"AlarmName":"isc-fes-api-server-notification-test","NewStateValue":"ALARM","OldStateValue":"OK","NewStateReason":"Discord通知経路の疎通確認","StateChangeTime":"Manual smoke test"}'
```

これはSNS以降の経路だけの確認になる。CloudWatch → SNSまで確かめる場合は、メンテナンス中に対象Alarmの状態を一時的に変更し、ALARM・OKの両方が届くことを確認する。

DashboardにCPU・Memory・Root Disk・Disk I/O・Networkのメトリクスが表示されることを確認する。
Agentの起動直後は、メトリクスの欠損によりCPU・Memory・DiskのALARMが一時的に届く場合がある。

通知が届かない場合は、CloudWatch Logsの`/aws/lambda/isc-fes-cloudwatch-discord`を確認する。

## 5. 監視期間終了後

`infra/aws/terraform.tfvars`を次へ変更してCommitし、メンテナンス時間にPlan・Applyする。期間の自動終了は行わない。

```hcl
api_server_instance_type = "t4g.micro"
cloudwatch_enabled       = false
```

```shell
terraform -chdir=infra/aws plan -out=end-monitoring.tfplan
terraform -chdir=infra/aws apply end-monitoring.tfplan
```

アラーム・Dashboard・SNS・Lambda・通知用Log Groupが削除され、SSM AssociationはAgentを停止・自動起動無効化する処理に切り替わる。
Associationを削除するだけでは既存EC2のAgentは止まらないため、Association自体は残す。SecureStringはTerraform管理外なので残る。
Agentが停止し、新しいメトリクスの送信が止まったことを確認する。
