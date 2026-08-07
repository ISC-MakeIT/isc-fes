# Terraform state bucket

後続のTerraform構成がRemote Stateを保存するためのS3バケットだけを作成する。
APIサーバー、ネットワーク、画像用S3などはこの構成では作成しない。

## 作成されるもの

- 非公開S3バケット
- StateのVersioning
- AES256によるサーバー側暗号化
- HTTPアクセスを拒否するBucket Policy

バケット名はAWSアカウント内で一意になるよう、`isc-fes-terraform-state-<AWS account ID>`となる。

## 実行

AWS CLIなどで使用するAWSアカウントへログインしてから実行する。

```shell
cd infra/bootstrap
terraform init
terraform plan
terraform apply
terraform output -raw state_bucket_name
```

この段階のTerraform Stateは`infra/bootstrap/terraform.tfstate`へローカル保存される。
後続の構成をS3 Backendへ移行し終えるまで、このファイルを削除しないこと。

`terraform.tfstate`と`.terraform/`はGit管理対象外になっている。

## 削除について

Stateを誤って失わないよう、S3バケットには`prevent_destroy`を設定している。
通常の`terraform destroy`では削除されない。
