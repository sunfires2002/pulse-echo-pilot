# 検証用2ユーザーのパスワード設定：一度限りのローカルツール

対象：`pulse-echo-security-lab` の既存管理者・非管理者。ユーザーを作成・削除せず、UUIDとRLSを維持する。

**今回の実装段階では実APIによるパスワード変更は未実施。実行には別途承認が必要。**

## 変更しないもの

main、本番接続、既存管理画面、メール再設定画面、RLS・GRANT、試合・反応データ、PRISM CUT、`.admin-lab.private.json` の形式・内容。既存サーバーの再起動は不要。

## 安全な起動

MacのTerminalでLABフォルダーへ移動する。

```sh
cd /Users/momo/.codex/visualizations/2026/10/25/01a170ab-dbd7-7d13-b1ce-7dd62b47f5b9/admin-safety-lab
python3 -B tools/admin_password_once.py
```

引数なしでは所有者専用の保存済み検証設定と固定プロジェクト識別を検査するだけ。ネットワーク通信・メール送信・Auth操作はしない。

入力の確認だけを行う場合：

```sh
python3 -B tools/admin_password_once.py --check-inputs
```

こちらも通信しない。Terminal以外、パイプ入力、出力のリダイレクトは拒否する。非表示入力に失敗した場合、表示入力へ切り替えず停止する。

## 実行前に利用者が確認する項目

1. Supabase管理画面でプロジェクトが **pulse-echo-security-lab** であることを確認する。
2. 保存済みローカル設定のproject refと管理画面のrefが一致することを確認する。プログラムにも今回確認した検証refのSHA-256を固定してあり、別プロジェクトへの設定差し替えは拒否する。
3. Authenticationの既存ユーザー2人について、UUID・メールアドレス・メール確認済み状態を確認する。管理者UUIDはローカル設定とも照合する。どの値もチャットへ送らない。
4. 検証用プロジェクトのAPI Keysにある **Legacy API Keysのservice_roleキー（JWT形式）** を確認する。JWT署名用の「JWT Secret」や、publishable/anonキー、個人アクセストークンではない。
5. AuthのEmail Templates／Security notificationsにある **Password changed** の通知設定を確認する。管理API更新でも関連通知の有無は実行前に確認が必要。このツールは設定を読み取ったり変更したりしない。

今回のツールは、通知OFFを利用者が確認して `CHECKED_OFF` と入力しない限り、先へ進まない。これは利用者による確認であり、ツールによる設定検証ではない。ONまたは不明なら停止し、別途相談する。勝手に通知設定を変更しない。

### なぜ新形式のsb_secretキーを受け付けないか

`sb_secret_…` は不透明なキーなので、入力文字列だけでは所属プロジェクトを確認できない。接続する前に本番キーを拒否する条件を守るため、今回はプロジェクトrefを持つ旧形式service_role JWTに限定する。

JWTのrole・ref・有効期限・発行元・形式を接続前に確認する。これは接続先取り違え防止であり、署名の真正性確認ではない。実際の署名と管理権限は固定した検証用Auth API側が検証する。検証用の旧形式キーが取得できない場合は、この版では実行不可。新形式キーを貼って試さない。

## 別途承認された後だけ実行するコマンド

```sh
python3 -B tools/admin_password_once.py --execute
```

入力順：

1. プロジェクト名 `pulse-echo-security-lab` と検証用project refを確認入力。
2. 通知設定の確認後に `CHECKED_OFF`。
3. 検証用service_roleキーを非表示入力。
4. administratorの既存UUID・メール・新パスワード・確認用パスワードを非表示入力。
5. non_administratorも同様に非表示入力。
6. `VERIFY_EXISTING_USERS` で既存ユーザー2人のAuth情報を読み取り、UUID・メール・確認済み状態を照合。
7. `UPDATE_ADMINISTRATOR` で管理者のパスワードだけを更新。
8. `UPDATE_NON_ADMINISTRATOR` で非管理者のパスワードだけを更新。

パスワードは12〜256文字、UTF-8で72バイト以内。改行・制御文字・空白だけ・確認不一致を拒否する。Supabase側のパスワード要件により追加拒否される場合がある。

2人とも既存ユーザーと確認できてから最初の更新を行う。更新直前にも再照合し、更新レスポンスとその後の読込で同じUUIDとメールであることを確認する。メール・metadata・確認状態・roleなどの変更項目は送らない。

## 通信と秘密情報

- 許可する通信は固定検証ホストの `/auth/v1/admin/users/{確認したUUID}` に対するGET／PUTのみ。
- PUT本文は `password` 1項目だけ。POST・DELETE・DB・Management API・回復メール送信・ログインは実装しない。
- OS標準のTLS検証、15秒タイムアウト。HTTPリダイレクトと環境変数によるプロキシ転送は使わない。
- キー・パスワードをコマンド引数、環境変数、ファイル、ブラウザー、ログ、Gitに渡さない。既存のprivate設定へ追加しない。ネットワークエラーの生本文やレスポンスも表示しない。
- core dumpを無効化する。終了時に保持参照を解放するが、Pythonのメモリー全体の物理的消去まで保証するものではない。
- HTTP成功は新パスワードでログインできたことの証明ではない。更新後は既存のAuth診断を別途実行する。

## 失敗と再実行

- 2ユーザー更新はトランザクションではない。途中で停止した場合、1人目だけ更新済みになる可能性がある。固定のrole名と進捗だけを表示する。
- PUT後に通信が切れた場合は `unknown_do_not_retry`。自動再試行・自動復旧はしない。先に新パスワードでAuth診断し、結果を確認してから次の操作を判断する。
- パスワード変更に伴う既存Authセッションへの影響は実環境で未検証。設定後は新しくログインし直す。
- 一度限りの作業用。繰り返し起動を禁止する永続マーカーは保存しないため、承認なしに `--execute` を再実行しない。

## ローカル検証

```sh
python3 -B tests/admin-password-once.py
```

架空キー・架空ユーザーと模擬HTTPS応答だけを使用する。固定接続先、本番／別プロジェクト拒否、キー検査、UUIDとメールの一致、更新ペイロード限定、キャンセル、部分成功、通信断の無再試行、HTTPエラーの非表示、非対話入力拒否、実際の疑似Terminalによる非表示入力を検証する。

実Supabase、実アカウント、実パスワード変更、通知メール、実Auth再ログインは未検証。

参考：
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/auth-email-templates

今回の検証結果：ローカル試験15項目が成功（実HTTPS接続は模擬化）。既存Auth診断の秘匿・制限テストと管理バックエンドの契約テストも成功。保存済み検証設定の読み取り専用検査が成功。実管理API・メール・ユーザー更新は0件。
