# AWS infrastructure

APIサーバーを動かすAWSリソースを段階的に追加するTerraform構成。

現在この構成が管理するのは次のリソース。

- BackendのDocker imageを保存する非公開ECRリポジトリ
- APIサーバーを配置するVPCとPublic Subnet
- Public Subnetをインターネットへ接続するInternet GatewayとRoute Table
- APIサーバーへの通信を制御するSecurity Group
- APIサーバーがSSMとECRを利用するためのIAM RoleとInstance Profile

EC2、画像用S3、CloudFrontなどはまだ作成しない。

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

EC2用IAM Roleには次の権限だけを付与する。

- Systems ManagerでEC2を管理するための`AmazonSSMManagedInstanceCore`
- このTerraformで管理するBackend用ECR RepositoryからImageをpullする権限

画像用S3へのアクセス権限は、画像用Bucketを作成する段階で追加する。

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
