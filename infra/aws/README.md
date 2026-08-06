# AWS infrastructure

APIサーバーを動かすAWSリソースを段階的に追加するTerraform構成。

現在この構成が管理するのは、BackendのDocker imageを保存する非公開ECRリポジトリだけ。
EC2、VPC、S3、CloudFrontなどはまだ作成しない。

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

`terraform apply`前に、ECR関連だけが追加対象になっていることを確認する。

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
