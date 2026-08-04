# LocalStack init

このプロジェクトでは AWS S3 をローカルでエミュレーションするために LocalStack を使用している。
LocalStack では ready 時などに hook 的にスクリプトを呼び出すことができ、この init ディレクトリでは LocalStack の起動時に S3 バケットを作成するスクリプトを配置している。

## FYI

- compose.yaml で LocalStack の ready hook のディレクトリに init ディレクトリをマウントしている
- init ディレクトリのスクリプトは LocalStack の ready hook で呼び出されるため、LocalStack のコンテナ内で実行される
