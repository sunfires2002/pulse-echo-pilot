# 検証用Supabase：既存ユーザーのパスワード再設定

対象は `pulse-echo-security-lab` のみ。本番・ユーザーUUID・RLS・試合データは変更しない。

## 起動と設定（Supabase側の変更は利用者が行う）

1. 所有者専用 `.admin-lab.private.json` を使って起動する。

   ```sh
   python3 tools/serve-admin-safety-lab.py --port 8082 --config-file .admin-lab.private.json
   ```

2. Macで `http://127.0.0.1:8082/admin-password-reset.html` を開く。
3. **検証用**プロジェクトの Authentication → URL Configuration で以下を設定する。
   - Site URL: `http://127.0.0.1:8082`
   - Redirect URLs: `http://127.0.0.1:8082/admin-password-reset.html`（完全一致。ワイルドカード不要）
4. 標準のRecoveryメールテンプレートの確認リンク（ConfirmationURL）を使用する。独自のcode交換用テンプレートはこの画面の対象外。localhostと127.0.0.1を混在させない。

## 操作順序

1. 専用画面から管理者の**既存メールアドレス**へ新しい再設定メールを送る。
2. サーバーを起動したまま、このMacで最新のメールを開く。リンク全文・アドレスバー・トークンを共有・撮影しない。
3. 「リンクを確認しました」の表示後、新しいパスワードを2回入力して保存する。
4. 成功表示を確認し、タブを閉じる。保存時に返されたユーザーUUIDが認証時と同一であることを内部照合する。実際のUUIDは表示しない。
5. 既存の `python3 tools/run-admin-security-lab-tests.py --diagnose-auth` で新しいパスワードを使い、管理者の認証とUUID一致を確認する。
6. 非管理者も同じ順序で再設定し、Auth診断する。試合CRUDテストは引き続き停止中。

## 安全設計

- 8082 / 127.0.0.1限定。設定のプロジェクト参照・URL一致、publishableキー形式、本番ホスト拒否を検査。
- Supabase公式 `resetPasswordForEmail` に専用URLを明示する。既存ユーザーの有無を画面で断定しない。
- 標準のimplicit recovery形式のみ受け付ける。ページ冒頭でフラグメント・クエリーをアドレスバーから除去してからSDK等を読み込む。URLをログに出さない。
- `type=recovery` と必要なトークンを確認し、公式 `setSession` → サーバーの `getUser` 検証が成功した場合だけ保存欄を開く。URL内のtypeやJWTの自己申告だけを信用しない。
- 保存直前にも `getUser` で同一ユーザーを検証し、`updateUser({password})` のみ実行する。管理者判定は不要（非管理者も自分のパスワードを変更できる）。
- `persistSession:false`・自動更新なし・独立storageKey。通常管理画面のsessionStorage、公開画面のlocalStorageには触れない。再設定セッションはメモリー内だけ。
- 成功後は `signOut({scope:'local'})`。他端末を対象にした全セッションのログアウト要求はしない。再読み込み・タブ終了でこの画面の認証状態を破棄する。
- 通信は明示した検証用ホストのAuth API（recover、refresh token、user、local logout）だけ。DB・REST・WebSocketは使わない。CSPでもAuthパスに制限。Referrer-Policyはno-referrer。
- 無効・使用済み・期限切れメールリンクは新規発行へ案内。メールリンクの一度限りの検証はSupabase側で行う。URLから取り出した認証トークン自体を独自の一回限りトークンに変換する実装はしない。
- パスワードは12文字以上＋一致確認。プロジェクト側のより強いパスワード条件も適用される。生のAuthエラー、メール、パスワード、JWTは出力しない。
- 失敗・応答不明を成功と表示せず、自動再試行しない。応答不明ならAuth診断で結果を確認してから再設定を判断する。

## 検証範囲

ローカルChromeでは実際のSupabase SDKを読み込み、架空のAuth応答を全件遮断・置換してテストする。実メール送信・既存ユーザーのパスワード変更・本番接続は行わない。

```sh
NODE_PATH=/path/to/node_modules ADMIN_RESET_OUT=/absolute/path/to/evidence node tests/admin-password-reset.cjs
```

evidenceには検証用の公式SDK `supabase.js` を事前に用意する。8082のテスト用サーバーには架空設定を使う。通常の検証用設定での起動後にこのテストを実行しない。

未検証：利用者によるURL設定後の実メール受信・再設定・再ログイン、Supabaseによる使用済みリンク拒否の実画面、Safari実機。ローカル模擬試験と区別する。

公式資料：
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-setsession
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/auth/redirect-urls

今回のローカル結果：再設定テスト10項目群、既存管理LABのブラウザー回帰14項目、Auth診断の秘匿・停止制御テスト、管理バックエンドの契約テストが成功。Supabase実通信0件。保存済み設定で8082の初期画面が起動し、操作前にAuth通信が発生しないことも確認した。
