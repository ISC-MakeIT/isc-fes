# Production containers

EC2上でPostgreSQL、Database migration、Backend APIを動かすDocker Compose定義。

## Services

- `db`: PostgreSQL 17。Dataは`postgres-data` volumeへ永続化する
- `migrate`: `db`の起動後にmigrationを適用し、正常終了する
- `api`: migrationの正常終了後に起動する

`postgres-data`はContainerを再作成しても維持されるが、現状はEC2のRoot EBS上にある。
EC2の置換やVolume障害からは復旧できないため、Database backupは本番公開前に別途追加する。

DatabaseとAPI間の通信には`backend`内部Networkを使用する。
APIだけを`outbound` Networkにも接続し、S3、Google OAuth、EC2 Instance Metadataへ外向きに通信できるようにする。
この段階ではAPIのPortをHostやInternetへ公開しない。HTTPSを終端するReverse Proxyは後続Stepで同じNetworkへ追加する。

## Configuration

`.env.example`をもとに、EC2の`/opt/isc-fes/.env`へ実際の値を配置する。
`.env`はGit管理せず、TerraformのStateにもSecretを保存しない。

`BACKEND_IMAGE`には`make push-backend-image`でECRへpushした、不変なCommit SHA Tagを指定する。
Container内ではEC2のIAM Roleを使うため、AWS Access Keyは設定しない。

現在は構成ファイルだけを定義している。EC2へのDocker Compose Pluginの導入、`.env`の安全な配布、ECR Login、起動処理は後続Stepで追加する。

## Validate locally

値を設定した`.env`を用意した後、Imageをpull・起動せずにCompose定義を検証できる。

```shell
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
```
