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
- 店舗画像を保存する非公開S3 BucketとEC2からのアクセス権限
- EC2が実行時設定をParameter Storeから取得するためのアクセス権限
- GitHub ActionsがOIDCで認証し、Backend ImageをECRへpushするためのIAM Role

APIの起動設定、CloudFrontなどはまだ作成しない。

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

| Port | Protocol | Source | Purpose |
| --- | --- | --- | --- |
| 443 | TCP | `0.0.0.0/0` | HTTPS |

SSH、APIの内部Port、DatabaseのPortはインターネットへ公開しない。
EC2の管理にはAWS Systems Manager Session Managerを使用する。

EC2用IAM Roleには次の権限を付与する。

- SSM管理機能と対象Parameterの読取だけを許可するCustom Policy
- このTerraformで管理するBackend用ECR RepositoryからImageをpullする権限
- Parameter Storeの`/isc-fes/prod/runtime-env`を読み取る権限

AWS管理Policyの`AmazonSSMManagedInstanceCore`は、全Parameterに対する`ssm:GetParameter`を含むため使用しない。
同等のSSM管理機能と対象Parameterだけの読取権限を持つCustom Policyを使用する。

## API server instance

| Setting | Value |
| --- | --- |
| AMI | 最新のAmazon Linux 2023 ARM64 |
| Instance type | `t4g.micro`（2 vCPU、1 GiB Memory） |
| CPU credits | `standard` |
| Root volume | 20 GiB gp3、暗号化あり |
| Public IP | Elastic IPを明示的に関連付け |
| SSH key pair | なし |

ECRへpushするBackend ImageがARM64なので、EC2にもARM64のGraviton Instanceを使用する。
Public IPv4 Addressの自動割り当ては無効化し、学校側のDNSへ設定するElastic IPだけを使用する。
AMIの更新だけでは既存EC2を自動置換せず、OS更新は別の明示的な作業として実施する。

Instance Metadata ServiceはIMDSv2を必須にする。
将来Docker Container内のAPIがIAM Roleを使ってS3へアクセスできるよう、Metadataのhop limitは2にする。

ContainerはUser Dataでは起動せず、後述の設定AssociationとSSM Run Commandを組み合わせてデプロイする。
EC2への管理接続にはSession Managerを使用する。

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
- Compose定義とCaddyfileはRepositoryの`deploy`配下からBase64で転送する
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

APIサーバーのIAM Roleには`stores/*`配下のObjectに対する`PutObject`、`GetObject`、`DeleteObject`だけを許可する。
Bucketは直接公開せず、現段階ではBackendが発行するPresigned URLで画像を取得する。
`images.fes.iwasaki.ac.jp`とCloudFrontは後続Stepで追加する。

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

`terraform apply`前に、意図したリソースだけが追加対象であり、既存リソースの変更・削除がないことを確認する。

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

Terraform適用後、次のTerraform OutputをGitHub Repository Variableへ設定する。

初回導入時は、このWorkflow変更を`main`へmergeする前にTerraformを適用し、
Repository Variableを設定する。先にmergeすると、最初のWorkflowはAWS認証情報を
取得できず失敗する。

| Repository Variable | Terraform Output |
| --- | --- |
| `AWS_ECR_PUSH_ROLE_ARN` | `github_actions_ecr_push_role_arn` |
| `AWS_ACCOUNT_ID` | `aws_account_id` |

```shell
terraform -chdir=infra/aws output -raw github_actions_ecr_push_role_arn
```

GitHub CLIを使う場合は次のCommandで設定できる。

```shell
gh variable set AWS_ECR_PUSH_ROLE_ARN \
  --body "$(terraform -chdir=infra/aws output -raw github_actions_ecr_push_role_arn)"

gh variable set AWS_ACCOUNT_ID \
  --body "$(terraform -chdir=infra/aws output -raw aws_account_id)"
```

`main`へのpush時は既存CIがすべて成功した後、次のImageをECRへpushする。

```text
<repository URL>:sha-<full Git Commit SHA>
```

同じCommit SHAのImageが既に存在する場合はbuildとpushを省略する。
このWorkflowはEC2、SSM、Docker Compose、Caddyを操作せず、ECRへのImage pushだけを行う。
