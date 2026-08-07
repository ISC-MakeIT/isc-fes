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

`BACKEND_IMAGE`はSecretへ含めず、後続のデプロイ処理から`make push-backend-image`でECRへpushした不変なCommit SHA Tagを渡す。
Container内ではEC2のIAM Roleを使うため、AWS Access Keyは設定しない。

実際の値を設定した後、次のコマンドで`/isc-fes/prod/runtime-env`へ`SecureString`として保存する。

```shell
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# deploy/.envのプレースホルダーをすべて実際の値へ置換する
make put-runtime-env
```

登録スクリプトは、必須項目、未置換のプレースホルダー、4KBのStandard Parameter上限、Compose構文、AWS Accountを検証する。
Secret値はコマンドラインへ展開せず、TerraformでもParameter本体を管理しない。
Parameter Store Standardを使用するため追加料金は発生しない。

EC2へのDocker Compose Pluginと初期設定ファイルはTerraformで導入する。
通常のデプロイでは後述のスクリプトがParameter Storeから`.env`を更新し、ECR LoginとContainerの起動を行う。

## Validate locally

値を設定した`.env`を用意した後、Imageをpull・起動せずにCompose定義を検証できる。

```shell
BACKEND_IMAGE=<ECR-image-URI> \
  docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
```

## Deploy the Backend

作業ツリーがCleanな状態で、現在のGit Commit SHAをTagにしたBackend imageをECRへpushする。
その後、同じImageをSystems Manager経由でEC2へデプロイする。

```shell
make push-backend-image
make deploy-backend
```

デプロイスクリプトは次の処理を行う。

- ECRに対象のCommit SHA Tagが存在することを確認
- EC2上でRuntime環境変数をParameter Storeから再取得
- ECRへ一時的にLoginしてImageをpull
- 同時デプロイをFile lockで防止
- Database migrationを含むCompose projectを起動
- APIのhealthcheckが成功するまで最大5分待機
- SSM Run Commandの標準出力とエラーをローカルへ表示

APIとDatabaseのPortはまだInternetへ公開しない。
