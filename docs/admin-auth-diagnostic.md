# 管理者/非管理者のAuth診断（このコマンドは試合操作なし）

## 状態

利用者からログイン時400 != 200の報告あり。旧テストは同じassertメッセージを両役割で使っていたため、どちらの認証で失敗したか分からなかった。
また、管理者ログイン後に非管理者ログインで失敗すると、旧finallyが試合の後片付け経路へ進み得た。今回は別のAuth専用入口を設け、試合の読取・登録・更新・削除へ進まない構造にした。

## 実行

Mac Terminalから：

```sh
python3 /Users/momo/.codex/visualizations/2026/10/25/01a170ab-dbd7-7d13-b1ce-7dd62b47f5b9/admin-safety-lab/tools/run-admin-security-lab-tests.py --diagnose-auth
```

- 管理者/非管理者のメールもパスワードも非表示入力。
- 保存済みのGit除外・所有者限定設定を使用。本番ホストと秘密キーを拒否。
- `--run`は独立したRLS実動作試験。検証用の架空試合を操作するので、Auth診断には使わない。
- RLS試験は対話式ランチャーから実行し、環境変数を手動設定して確認を省略しない。手順はadmin-security-client-test-plan.mdを参照。
- 診断中は8082の管理画面からも試合を保存しない。

## 出力

役割、HTTPステータス、許可リスト内のAuth/OAuthエラーコード、固定カテゴリ、UUID一致/不一致だけを表示する。
レスポンス本文、message/error_description、メール、パスワード、APIキー、JWT、refresh token、実際のUUIDは出力しない。
不明なコードはその文字列を出さず、unclassified_auth_errorとする。個人情報が含まれた未知コード/エラー/例外も表示しない。

例（架空の結果）：

```text
管理者 | HTTP 200 | code=none | category=authenticated | UUID確認=matched
非管理者 | HTTP 400 | code=invalid_credentials | category=credential_pair_not_accepted | UUID確認=not_checked
```

成功時は、この診断で新しく作った認証セッションだけをscope=localで終了する。終了結果は認証結果と別に表示し、元のAuthエラーを上書きしない。
ログアウトだけで発行済みアクセストークンの即時失効を証明するものではない。

## 切り分け

| コード/状態 | 解釈・次の確認 |
|---|---|
| email_not_confirmed | Authがその入力アカウントをメール未確認と判定。接続先/入力対象と確認済みユーザーを照合 |
| invalid_credentials | 入力した認証情報の組を受け付けなかった。誤パスワードとは断定不可。別プロジェクトや入力メールの取り違えも確認 |
| HTTP429 / over_request_rate_limit等 | レート制限。その場で次の役割も停止し、自動再試行しない |
| user_banned | アカウント利用制限を管理画面で確認。勝手に解除しない |
| email_provider_disabled | 検証プロジェクトのメール認証設定を確認。勝手に変更しない |
| HTTP401・不明コード | キーと接続先、ゲートウェイ/認証拒否を確認。生レスポンスは共有しない |
| invalid_grant | 一般的なOAuthエラー。400だけと同様、原因をこれだけで断定しない |
| HTTP200・UUID不一致 | 認証自体と役割設定を分離。入力アカウントの取り違えを確認。実UUIDは出力しない |

1回の実行で各役割のログインは最大1回。通信失敗/レート制限なら以降を停止する。パスワード再設定・確認メール再送・アカウント作成・Auth/RLS設定変更は行わない。

## 検証状況

tests/admin-auth-diagnostic-unit.cjsで、管理者だけ失敗/非管理者だけ失敗、未確認メール、認証情報拒否、429、通信例外、未知コードへの個人情報混入、CLI表示への値漏れ、未承認の試合試験が停止することを通信なしで検証。

検証用Authの公開設定GETはHTTP200、external.email=trueを確認済み。プロバイダー全体の無効化は確認されなかった。ただし個々のログイン失敗原因の証明ではない。

実アカウントのコードは利用者による手元入力の結果待ち。400という報告だけで原因を断定しない。本番・試合データ・認証設定は変更しない。

公式参照：
https://supabase.com/docs/guides/auth/debugging/error-codes
https://supabase.com/docs/guides/auth/rate-limits
