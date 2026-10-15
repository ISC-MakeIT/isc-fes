# AWS infrastructure

APIサーバーを動かすAWSリソースを段階的に追加するTerraform構成。

現在この構成が管理するのは次のリソース。

- BackendのDocker imageを保存する非公開ECRリポジトリ
- APIサーバーを配置するVPCとPublic Subnet
- Public Subnetをインターネットへ接続するInternet GatewayとRoute Table
- APIサーバーへの通信を制御するSecurity Group
- APIサーバーがSSMとECRを利用するためのIAM RoleとInstance Profile
- APIサーバーを動かすEC2と固定Public IPv4 Address
- EC2へDocker実行環境を設定するSystems Manager Association
- EC2へDocker Compose Pluginを設定するSystems Manager Association
- EC2へRuntime環境変数とCompose定義を配置するSystems Manager Association
- EC2へCloudWatch Agentを設定するSystems Manager Association、標準アラーム5本、Dashboard1つ
- CloudWatch AlarmをDiscordへ転送するSNS・Lambda
- 店舗画像を保存する非公開S3 BucketとEC2からのアクセス権限
- 非公開S3 Bucketの店舗画像を配信するCloudFront DistributionとOAC
- `img.fes.iwasaki.ac.jp`用のACM Certificate申請
- EC2が実行時設定をParameter Storeから取得するためのアクセス権限
- GitHub ActionsがOIDCで認証し、Backend ImageをECRへpushするためのIAM Role

APIの起動設定は別のデプロイスクリプトで管理する。

## Network

```text
VPC:           10.10.0.0/16
Public Subnet: 10.10.1.0/24
Route:         0.0.0.0/0 -> Internet Gateway
```

Public Subnetは東京リージョンで利用可能な最初のAvailability Zoneへ作成する。
NAT Gatewayは使用せず、EC2に関連付けたElastic IPから直接Internetへ接続する。

## API server access

Security Groupの受信ルールは次の通信だけを許可する。

| Port | Protocol | Source      | Purpose |
| ---- | -------- | ----------- | ------- |
| 443  | TCP      | `0.0.0.0/0` | HTTPS   |

SSH、APIの内部Port、DatabaseのPortはインターネットへ公開しない。
EC2の管理にはAWS Systems Manager Session Managerを使用する。

EC2用IAM Roleには次の権限を付与する。

- SSM管理機能と対象Parameterの読取だけを許可するCustom Policy
- このTerraformで管理するBackend用ECR RepositoryからImageをpullする権限
- Parameter Storeの`/isc-fes/prod/runtime-env`を読み取る権限

AWS管理Policyの`AmazonSSMManagedInstanceCore`は、全Parameterに対する`ssm:GetParameter`を含むため使用しない。
同等のSSM管理機能と対象Parameterだけの読取権限を持つCustom Policyを使用する。

## API server instance

| Setting       | Value                               |
| ------------- | ----------------------------------- |
| AMI           | 最新のAmazon Linux 2023 ARM64       |
| Instance type | `t4g.medium`（2 vCPU、4 GiB Memory） |
| CPU credits   | `standard`                          |
| Root volume   | 20 GiB gp3、暗号化あり              |
| Public IP     | Elastic IPを明示的に関連付け        |
| SSH key pair  | なし                                |

ECRへpushするBackend ImageがARM64なので、EC2にもARM64のGraviton Instanceを使用する。
Public IPv4 Addressの自動割り当ては無効化し、学校側のDNSへ設定するElastic IPだけを使用する。
AMIの更新だけでは既存EC2を自動置換せず、OS更新は別の明示的な作業として実施する。

Instance Metadata ServiceはIMDSv2を必須にする。
将来Docker Container内のAPIがIAM Roleを使ってS3へアクセスできるよう、Metadataのhop limitは2にする。

ContainerはUser Dataでは起動せず、後述の設定AssociationとSSM Run Commandを組み合わせてデプロイする。
EC2への管理接続にはSession Managerを使用する。

`api_server_instance_type`で`t4g.micro`、`t4g.small`、`t4g.medium`を切り替える。
Instance Typeの変更はEC2の停止・再起動を伴うが、Root EBSとElastic IPは維持される。

## CloudWatch monitoring

学園祭期間（負荷試験・本番）だけ`cloudwatch_enabled = true`で監視を有効にする。
適用・疎通確認・期間終了時の手順は[監視設定の適用手順](monitoring-setup.md)を参照する。

### メトリクス

CloudWatch AgentをSSM Associationで導入し、60秒間隔で`ISCFes/EC2`へ送信する。
EC2のIAM Roleには`ISCFes/EC2`への`cloudwatch:PutMetricData`だけを追加し、アプリケーションのログは収集しない。
`aggregation_dimensions`と`drop_original_metrics`で`InstanceId`だけの系列にまとめ、CPU Core・Docker Interface単位の系列は送らない。

| 対象 | 系列数 | 収集範囲 |
| ---- | -----: | -------- |
| CPU | 5 | 全CoreをまとめたHost全体の使用率 |
| Memory | 6 | HostのMemory |
| Swap | 3 | HostのSwap |
| Disk | 5 | `/`のみ |
| Disk I/O | 7 | Root EBSのDeviceのみ。Device名はEC2上で解決 |
| Network | 4 | Default RouteのInterfaceのみ。Dockerとloopbackは対象外 |

AWS標準の`CPUCreditBalance`、`CPUCreditUsage`、`StatusCheckFailed`も併用する。有料のDetailed Monitoringは使わない。

### アラーム

| アラーム | 閾値 | 判定期間 |
| -------- | ---- | -------- |
| CPU | 使用率80%以上 | 60秒 × 3回 |
| Memory | 使用率85%以上 | 60秒 × 3回 |
| Disk | 使用率85%以上 | 60秒 × 3回 |
| CPU Credits | 残量144以下 | 300秒 × 1回 |
| EC2 Status | Status Check失敗 | 60秒 × 2回 |

CPU・Memory・Diskはメトリクスの欠損も異常として扱い、Agentの停止・送信不能を検知する。
CPU Creditsの閾値は、t4g.mediumが2 vCPU全負荷で1時間に差し引き96消費することから、抑制まで約1.5時間の猶予を残す値にしている。
閾値は負荷試験の結果で調整する。

### Discord通知

アラームの発生（ALARM）と復旧（OK）を、SNS → Lambda → Discord Incoming Webhookで通知する。
Lambdaは`lambda/discord_notifier.mjs`の1ファイルで、ビルドせずにZIP化して配置する（Node.js 24 RuntimeのAWS SDK v3を使用）。
送信に失敗した実行はLambdaの非同期呼び出しの既定動作で2回再試行され、失敗はLambdaのLog Group（7日保持）で確認する。

- Webhook URLは`/isc-fes/prod/discord-webhook-url`のSecureStringに保存し、Terraform State・Lambda環境変数には含めない。
- `discord_mention_user_ids`に指定したDiscord User IDだけをメンションする。検証はTerraformの変数Validationで行う。

### 費用

通知（SNS・Lambda・KMS・Logs）は1,000件で約2円と小さく、追加の予算枠は設けない。
主な費用はmediumへの増強とCloudWatchのメトリクス・アラーム・Dashboardで、[費用試算](https://app.notion.com/p/3f5891c6d9498044a1c6dd2970115d85)の予備費500円に含めて管理する。
期間終了後にmicroへ戻し、監視を無効にすることが費用試算の前提。

## Docker runtime bootstrap

Systems Manager State ManagerのAssociationを使用し、対象EC2へ次の設定を適用する。

- Amazon Linux RepositoryからDockerをインストール
- Docker Serviceを起動し、OS起動時の自動起動を有効化
- Application配置先として`/opt/isc-fes`を作成

Associationは対象EC2の作成後に実行され、成功するまでTerraformが待機する。
EC2が置換された場合は新しいInstance IDがTargetになり、同じ設定が新しいEC2へ適用される。

実行するShell ScriptにSecretは含めない。
API、Database、CaddyのContainerは別のCompose定義とデプロイスクリプトで管理する。

## Docker Compose Plugin

Docker本体の設定完了後、別のSystems Manager AssociationでDocker Compose Pluginを導入する。

- Versionは`v5.4.0`に固定
- EC2のCPU Architectureに合わせて公式Linux ARM64 Binaryを使用
- DownloadしたBinaryのSHA-256を固定値と照合
- System-wide CLI Pluginとして`/usr/local/lib/docker/cli-plugins/docker-compose`へ配置
- `docker compose version`が成功するまでTerraformが待機
- Docker Composeがすでに利用可能な場合はDownloadを省略

VersionとChecksumはDocker Composeの公式GitHub Releaseを参照して明示的に更新する。
Secret取得やApplication Containerの起動はこのAssociationでは行わない。

## Runtime configuration access

APIサーバーのIAM Roleには、次のParameterだけに対する`ssm:GetParameter`を許可する。

```text
/isc-fes/prod/runtime-env
```

Parameter本体とSecret値はTerraformで作成しない。
これによりSecretがGitやTerraform Stateへ保存されることを防ぐ。
Parameterは`SecureString`として作成し、EC2上のデプロイ処理から復号して取得する。

## Runtime configuration installation

Docker Composeの設定完了後、別のSystems Manager Associationで次のファイルを配置する。

```text
/opt/isc-fes/.env         mode 0600
/opt/isc-fes/compose.yaml mode 0644
/opt/isc-fes/Caddyfile    mode 0644
```

- `/isc-fes/prod/runtime-env`はEC2上で直接復号し、標準出力へ書き出さない
- Compose定義とCaddyfileはRepositoryの`infra/deploy`配下からBase64で転送する
- 両方のSHA-256を配置前に検証する
- 一時ファイルに対して`docker compose config --quiet`を実行する
- 検証成功後にだけ既存ファイルを置き換える
- `/opt/isc-fes`はrootだけが参照できるmode `0700`にする

このAssociationは設定ファイルの配置だけを行い、ECR Login、Imageのpull、Containerの起動は行わない。

## HTTPS reverse proxy

Caddy `2.11.4-alpine`をBackend APIと同じCompose projectで起動する。

- `api.fes.iwasaki.ac.jp`の443/TCPを受け付け、内部Networkの`api:8080`へ転送する
- APIの8080番とPostgreSQLの5432番はHostへ公開しない
- 80番は開放せず、証明書取得にはTLS-ALPN-01 Challengeを使用する
- 証明書とCaddyの実行状態はDocker volumeへ永続化する
- Caddyfileはデプロイ前に公式Caddy imageで検証する

学校側のDNSには`api_server_public_ip` outputをA Recordとして設定する。

## Store images

店舗画像は次の非公開S3 Bucketへ保存する。

```text
isc-fes-images-<AWS Account ID>
```

- Public AccessをすべてBlock
- Object Ownershipは`BucketOwnerEnforced`
- SSE-S3（AES256）で暗号化
- Versioningを有効化
- 非Current Versionは30日後に削除
- 未完了のMultipart Uploadは7日後に削除
- TLSを使わないS3通信をBucket Policyで拒否
- TerraformによるBucket削除を防止

APIサーバーのIAM Roleには`images/*`配下のObjectに対する`PutObject`、`GetObject`、`DeleteObject`だけを許可する。
旧形式の`stores/*`と`menus/*`には、既存画像の配信と置き換え後の削除のため、`GetObject`と`DeleteObject`だけを引き続き許可する。
Bucketは直接公開せず、CloudFront Origin Access Controlからの`GetObject`だけをBucket Policyで追加許可する。
CloudFrontからS3へのRequestはSigV4で常に署名し、ViewerからはHTTPSだけを使用する。

店舗画像のURLには、CloudFrontに設定した独自ドメインを使用する。

```shell
terraform output -raw store_images_cloudfront_base_url
```

現行APIのPresigned URLから段階的に切り替えられるよう、EC2の`GetObject`権限はこの時点では残す。
CloudFront経由の画像取得とAPIの切り替えを確認した後、別の変更で削除する。

## Store image domain certificate

CloudFrontの独自ドメインに使用するACM Certificateは、CloudFrontの要件に合わせて
Virginia北部Region（`us-east-1`）へ申請する。

Terraformは学校側DNSの検証用CNAMEを使ってCertificateが`ISSUED`になるまで待機し、
CloudFrontに`img.fes.iwasaki.ac.jp`とCertificateを設定する。

適用後、学校側へ依頼する検証用CNAMEを次のOutputで取得する。

```shell
terraform output -json store_images_acm_dns_validation_records
```

ACMの検証がタイムアウトした後にDNSが設定された場合は、CNAMEが解決できることを確認してから再申請する。

```shell
dig +short CNAME <outputのname>
terraform apply -replace=aws_acm_certificate.store_images
```

`img.fes.iwasaki.ac.jp`の配信用CNAMEは、CloudFront標準ドメインを参照する。

## Remote State

Stateはbootstrapで作成した次のS3バケットへ保存する。

```text
s3://isc-fes-terraform-state-970835573274/isc-fes/aws/terraform.tfstate
```

Stateの同時更新はS3のlock fileで防止する。

## ECR repository

- Repository名: `isc-fes/backend`
- Tag: 上書き不可
- 保存時暗号化: AES256
- Push時の脆弱性スキャン: 有効
- Imageが存在する場合のTerraformによる強制削除: 無効
- Image保持数: 最新30世代

Tagを上書きできないため、デプロイ時は`latest`ではなくGitのCommit SHAなど、一意なTagを使用する。
31世代目以降の古いImageはLifecycle Policyによって自動削除する。

## Plan and apply

```shell
cd infra/aws
terraform init
terraform plan
terraform apply
terraform output -raw backend_repository_url
terraform output -raw api_server_public_ip
```

`terraform apply`前に、意図したリソースだけが変更対象であり、EC2・Root EBSの置換や意図しない削除がないことを確認する。

## Push a Backend image

ECRを作成し、変更をCommitした後に実行する。

```shell
make push-backend-image
```

現在のGit Commit SHAを使った一意なTagで、ARM64イメージをbuildしてpushする。

```text
<repository URL>:sha-<full Git Commit SHA>
```

Tagとソースコードの対応を保証するため、未コミットの変更がある場合は実行しない。

## Push a Backend image from GitHub Actions

GitHub Actionsは長期Access Keyを保存せず、GitHub OIDCで一時的なAWS認証情報を取得する。
IAM Roleの信頼Policyは`ISC-MakeIT/isc-fes`の`main` Branchだけに制限する。
OIDCのsubjectには、Repository名に加えてGitHubのOrganization IDとRepository IDを使用する。
名称変更や同名Repositoryの再作成があっても、別のRepositoryからRoleを引き受けられない。

Terraform適用後、次のTerraform OutputをGitHub Repository Variableへ設定する。

初回導入時は、このWorkflow変更を`main`へmergeする前にTerraformを適用し、
Repository Variableを設定する。先にmergeすると、最初のWorkflowはAWS認証情報を
取得できず失敗する。

| Repository Variable           | Terraform Output                         |
| ----------------------------- | ---------------------------------------- |
| `AWS_ECR_PUSH_ROLE_ARN`       | `github_actions_ecr_push_role_arn`       |
| `AWS_BACKEND_DEPLOY_ROLE_ARN` | `github_actions_backend_deploy_role_arn` |
| `AWS_ACCOUNT_ID`              | `aws_account_id`                         |

```shell
terraform -chdir=infra/aws output -raw github_actions_ecr_push_role_arn
terraform -chdir=infra/aws output -raw github_actions_backend_deploy_role_arn
```

GitHub CLIを使う場合は次のCommandで設定できる。

```shell
gh variable set AWS_ECR_PUSH_ROLE_ARN \
  --body "$(terraform -chdir=infra/aws output -raw github_actions_ecr_push_role_arn)"

gh variable set AWS_BACKEND_DEPLOY_ROLE_ARN \
  --body "$(terraform -chdir=infra/aws output -raw github_actions_backend_deploy_role_arn)"

gh variable set AWS_ACCOUNT_ID \
  --body "$(terraform -chdir=infra/aws output -raw aws_account_id)"
```

`main`へのpush時は既存CIがすべて成功した後、次のImageをECRへpushする。

```text
<repository URL>:sha-<full Git Commit SHA>
```

同じCommit SHAのImageが既に存在する場合はbuildとpushを省略する。

Image pushが成功した後、deploy Jobは`Name=isc-fes-api-server`のTagを持つ稼働中のEC2を1台だけ取得し、
SSM Run Command経由で`infra/deploy/scripts/deploy-backend.sh`を実行する。EC2上で対象Imageと最新のRuntime環境変数を取得し、
Docker Composeのhealth checkが成功するまで待機する。失敗した場合はdeploy Jobもfailureとなる。

deploy Jobは本番環境単位で直列化する。Image buildの完了順がCommit順と入れ替わっても古いImageへ戻さないよう、
deploy直前に対象SHAが現在のmainと一致することを確認する。
