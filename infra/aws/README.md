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
- 店舗画像を保存する非公開S3 BucketとEC2からのアクセス権限
- EC2が実行時設定をParameter Storeから取得するためのアクセス権限

APIの起動設定、CloudFrontなどはまだ作成しない。

## Network

```text
VPC:           10.10.0.0/16
Public Subnet: 10.10.1.0/24
Route:         0.0.0.0/0 -> Internet Gateway
```

Public Subnetは東京リージョンで利用可能な最初のAvailability Zoneへ作成する。
現段階ではEC2やNAT Gatewayを作らないため、このネットワーク基盤に時間単位の料金は発生しない。

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

現段階ではUser DataやAPI Containerの起動処理を設定しない。
EC2作成後はSession Managerで接続できることを確認する。

## Docker runtime bootstrap

Systems Manager State ManagerのAssociationを使用し、対象EC2へ次の設定を適用する。

- Amazon Linux RepositoryからDockerをインストール
- Docker Serviceを起動し、OS起動時の自動起動を有効化
- Application配置先として`/opt/isc-fes`を作成

Associationは対象EC2の作成後に実行され、成功するまでTerraformが待機する。
EC2が置換された場合は新しいInstance IDがTargetになり、同じ設定が新しいEC2へ適用される。

実行するShell ScriptにSecretは含めない。
API、Database、CaddyのContainerと環境変数は後続Stepで設定する。

## Runtime configuration access

APIサーバーのIAM Roleには、次のParameterだけに対する`ssm:GetParameter`を許可する。

```text
/isc-fes/prod/runtime-env
```

Parameter本体とSecret値はTerraformで作成しない。
これによりSecretがGitやTerraform Stateへ保存されることを防ぐ。
Parameterは後続Stepで`SecureString`として作成し、EC2上のデプロイ処理から復号して取得する。

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
