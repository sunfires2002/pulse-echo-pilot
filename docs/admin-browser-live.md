# 検証用管理画面：実ブラウザー操作試験

`codex/admin-safety-lab` 専用。実行にはMacで管理者→非管理者→後片付け用管理者の順に、表示付き専用Chromeへログインする。メール・パスワードをチャットやコードに渡さない。

## 実行条件

- 8082に保存済み検証設定で管理LABを起動済みであること。
- `.admin-lab.private.json` は所有者限定。検証refは固定指紋と照合する。
- Node/Playwright/Chromeを使用する。`ADMIN_BROWSER_OUT`はGit外の証跡保存先。既存の個人Chromeプロファイルは使わない。
- トレース、HAR、ログイン動画を保存しない。スクリーンショットは認証情報欄をマスクする。コンソールエラー本文・リクエスト本文・トークンは記録しない。

起動例（このMac）：

```sh
cd /Users/momo/.codex/visualizations/2026/10/25/01a170ab-dbd7-7d13-b1ce-7dd62b47f5b9/admin-safety-lab
NODE_PATH=/Users/momo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
ADMIN_BROWSER_OUT=/Users/momo/.codex/visualizations/2026/10/25/01a170ab-dbd7-7d13-b1ce-7dd62b47f5b9/admin-browser-evidence/real-browser \
/Users/momo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/admin-browser-live.cjs
```

## 操作

1. 専用Chromeの案内に従い、検証用管理者でログインする。以降は自動試験中のため触らない。
2. 案内が非管理者に変わったら、検証用非管理者でログインする。
3. 最後に案内が管理者へ戻ったら、同じ検証用管理者でログインする。架空試合の削除・残存確認・ログアウトまで自動実行する。

各入力待ちは最大10分。タイムアウトや途中終了で後片付けできなかった場合は、結果に表示される今回の試合IDだけを検証プロジェクトで確認する。既存試合を削除しない。

## 検証内容と区別

- 実認証・実DB：UI登録・更新・ページ再読み込み、二重保存時にPATCH1回、非管理者の画面ロックとブラウザーからのRLS拒否、UI削除、残存0、既存行との一致、ログアウト時の状態消去。
- エラー注入：管理者の保存応答を1回だけ403へ、読込応答を1回だけ403へ置換（503はSDKが自動再試行するため、この拒否表示試験では使わない）。これらは実権限拒否・実障害の再現とは区別する。
- 入力不正：空チーム名で保存拒否、DB不変。
- 全書込はこの実行の架空ID1件だけに制限。他ID、別ホスト、WebSocketは遮断する。
- 自然なJWT期限切れ、Safari/iPhone実機、公開版への反映は対象外。

## 結果

Git外の `results.json` に、成功・失敗段階・固定の検査名・リクエスト数・後片付け状態・認証欄を隠したスクリーンショット名だけを保存する。アカウント情報・JWT・キー・パスワードは保存しない。

`passed:true`、`cleanup:removed_verified_existing_rows_unchanged`、`blockedRequests:0`、`pageErrors:0` を確認する。後片付け失敗時は `manual_admin_cleanup_required` と架空試合IDが残る。検証済みとせず、先に後片付けする。

## 2026-11-03 実施結果

Macの専用Chrome（1440×1000）で利用者が管理者→非管理者→管理者の認証情報を直接入力し、実際の検証用Supabaseに対して13項目が成功した。

- 実UIの架空試合1件登録、更新、ページ再読込での復元、二重保存時のPATCH1回、UI削除を確認。
- 非管理者は管理画面とバックエンドの事前検査で拒否。認証済みブラウザーからの実PATCHもHTTP200／更新0行でRLS拒否を確認。管理者で読み直し、元データが変化していないことを確認。
- 保存403・読込403の注入では、成功誤表示なし・保存停止・再読込による復帰を確認。実障害とは区別する。
- 管理者・非管理者のログアウトで一覧・入力状態の消去と操作禁止を確認。
- 後片付け後、今回の行の残存0件と開始前の既存行との完全一致を確認。
- 本番への通信0件、想定外の接続試行0件、ページ例外0件。
- 証跡：Git外の `../admin-browser-evidence/real-browser-rerun/results.json` と認証欄をマスクした3画像。
- 既存の模擬Chrome回帰試験14項目も成功（実Auth/RLS試験とは別）。

初回は読込障害をHTTP503で1回だけ注入したところ、SDKが自動再試行して成功し、試験の期待と合わず停止した。この初回の架空試合は削除済み。拒否表示試験をHTTP403へ修正して再実行し成功した。管理画面本体の不具合修正は不要だった。

Safari/iPhone実機、JWTの自然な期限切れ、メール配送、本番移行は未検証。今回の認証情報は保存していないため、再実施時も手元で入力が必要。
