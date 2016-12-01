# r53ddnslmd
---
## 概要
### できること
* EC2インスタンスが起動(running)したらRoute53にAレコードを登録しに行く
  * Nameタグがあればソレを使い、無ければインスタンスIDを使う
  * すでに同一IPでAレコードが登録されていたら、それは削除する(全て削除する)
  * S3上にインスタンス情報(*1)とAレコードのNameをキャッシュする
* EC2インスタンスが停止(stopped)/削除(terminated)されたらRoute53からAレコードを消しに行く
  * 削除されたインスタンスのPrivateIPとマッチするAレコードを消す(全て削除する)
  * 削除されたインスタンスの情報はAPIで取得できないため、起動時に作成されたS3上のインスタンス情報(*1)を参照している

### 事前準備
* CloudWatch Eventを利用しているので、EC2インスタンスの状態変更通知をLambdaに流すように設定する
* S3にひとつバケットを作る
  * EC2インスタンスのTerminatedイベントを受け取った時にはすでにPrivateIPが死んでいるので、S3にキャッシュしている

### できていないこと・確認していないこと
* プライベートIPを変更した時やタグの変更など、EC2インスタンスの状態変更イベントに該当しない変更作業時のS3キャッシュ更新
* インスタンスIDからホスト名一覧を取得できるようになっているが、利用していない

## 使い方

### 動作確認

1. .envを自分の環境に合わせて設定する (see: https://www.npmjs.com/package/dotenv-safe )
2. runtime.js の AWS.config.update 部分を書き換える
3. npm install
4. npm start -- -i "instance-id" -s "running" ( インスタンスが起動したことにする → Route53にレコードが追加される )
5. npm start -- -i "instance-id" -s "terminated" ( インスタンスが削除されたことにする → Route53からレコードが削除される )

### デプロイ

1. .envを自分の環境に合わせて設定する (see: https://www.npmjs.com/package/dotenv-safe )
2. npm install
3. npm run build
4. npm run deploy
5. EC2インスタンスを作ったり消したりする

### 拡張

`npm install yu0819ki/r53ddnslmd` でとりあえずインストールできるので、 `generateHostName` あたりをオーバーライドして使うとよろしいかと。

また、 `mainHandler` をオーバーライドして、その他のイベントに対応できるようにしたりとかもやりやすい、はず。
