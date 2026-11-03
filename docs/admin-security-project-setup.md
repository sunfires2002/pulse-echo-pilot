# pulse-echo-security-lab：SQL適用前レビューと実行順

## 状態

利用者からSQL適用とAuthユーザー作成済みの報告あり。SQLを再適用しない。以下の適用手順は記録として保持し、接続準備はadmin-security-client-test-plan.mdに従う。

2026-11-03：利用者から別Supabaseプロジェクト作成済みと連絡あり。
GitHub未接続、Data API ON、Automatically expose new tables OFF、Automatic RLS ON。
Codexはどちらのプロジェクトにも接続・SQL実行していない。以下は静的レビューと、承認後に利用者が行う手順。
実際のAuth/RLS/GRANT動作はまだ未検証。

## 設定との適合

- Data API ONに加え、Exposed schemasにpublicが含まれることを管理画面で確認する。
- Automatically expose new tables OFFは自動のテーブル権限付与に依存しない設計と両立する。対象テーブルにだけ明示GRANTする。設定をONへ戻す必要はない。
- Automatic RLS ONでも、明示的なENABLE ROW LEVEL SECURITYと矛盾しない。
- 自動RLS機能が単なる有効化に加えて想定外のポリシーを生成した場合は、SQLを停止してレビューする。
- publicスキーマのUSAGEと、対象テーブルのSELECT/INSERT/UPDATE/DELETEは別の権限。今回両方を明示する。CREATE権限や全テーブルへのGRANTは付与しない。
- idはtextなのでシーケンス用GRANTは不要。更新トリガー関数のクライアントEXECUTEは取り消す。

## Authユーザーの順序（先に行う）

1. プロジェクト名がpulse-echo-security-labであることだけでなく、project ref/URLが本番と異なることを確認する。
2. Authenticationのメール・パスワードログインが有効であることを確認する。
3. Authentication > Usersから検証用管理者を手動作成。検証用メール・パスワードを設定し、メール確認済みにする。
4. 同様に検証用非管理者を作成し、管理者とは異なるUUIDであることを確認する。
5. 管理者のUsers詳細に表示されるUUIDをコピーする。プロジェクトID、APIキー、送信者ID、非管理者UUIDは使わない。
6. 新規登録画面は作らない。公開signupの設定変更は必要性を別途判断する。signupの可否に関わらず非管理者に書込権限はない設計。

パスワードをSQL、Git、チャット、画面キャプチャへ記載しない。UUID自体は秘密キーではないが、本人のものと確認する。

## SQL適用の順序（確認・承認後のみ）

1. 別プロジェクトのSQL Editorで、適用前に次のSELECTだけを実行する。

```sql
SELECT to_regclass('public.pulse_matches') AS existing_match_table;
SELECT to_regprocedure('public.admin_lab_touch_match()') AS existing_trigger_function;
```

両方NULLが前提。既存オブジェクトがあれば削除せず、状況を確認する。

2. sql/admin-safety-lab.sqlを開き、1か所だけのREPLACE_WITH_TEST_ADMIN_UUIDを検証用管理者UUIDへ置き換える。その他のSQLへ本番設定をコピーしない。
3. 適用前に内容を確認。CREATE TABLEのIF NOT EXISTSなし、anon書込GRANTなし、管理者UUID条件あり、futsal_goods操作なし、初期試合INSERTなしを照合する。
4. 利用者の確認後、BEGINからCOMMITまでをまとめて実行する。途中だけ実行しない。
5. UUID未設定・未作成・未確認メール、想定外ポリシー、既存テーブル/関数などでエラーになった場合はROLLBACK。IF NOT EXISTS、無条件許可、GRANT ALLへ書き換えて回避しない。
6. sql/admin-safety-lab-verify.sqlのSELECTで結果を確認する。

期待する結果：

| 検証項目 | 期待値 |
|---|---|
| RLS | true |
| anonのschema USAGE/SELECT | true/true |
| anonのINSERT/UPDATE/DELETE | 全false |
| authenticatedのschema USAGE/SELECT/INSERT/UPDATE/DELETE | 全true。ただし書込可能な行はRLSで管理者本人だけ |
| ポリシー | admin_lab_owner（指定UUIDのALL）とadmin_lab_public_read（公開行のSELECT）の2件 |
| ownerのUSING/WITH CHECK | 同じ管理者UUIDがリテラルとして入る |
| テーブルの行数 | 0。SQLは架空試合を自動登録しない |
| 更新トリガー | admin_lab_match_version |
| トリガー関数EXECUTE | anon/authenticatedともfalse |

更新トリガーはクライアントがRPCとして呼ぶものではない。実際にUPDATE時に動くことは次のクライアント試験で確認する。

## LAB接続はSQL検証の後

admin-lab-config.jsは現時点でmode local、URL・キー・UUIDは空のまま。今回接続しない。

後の承認でtools/configure-admin-security-lab.pyを使い、別プロジェクトのURL/ref・publishableキー・同じ管理者UUIDをGit除外のローカルファイルへ設定する。Git管理下のadmin-lab-config.jsは空のまま保つ。
起動サーバーの--config-fileへ渡すと、設定ファイルからCSPの接続先を決定する。本番ホスト/秘密キーを拒否するチェックを外さない。

管理者・非管理者・匿名の実トークン/実APIでRLSを検証する。SQL Editorでの成功を代用しない。既存tests/admin-safety-rls.cjsはこの段階でだけ使用し、専用プレフィックスの架空行以外を変更しない。

## 本番混入防止

- 今回変えたのはLABのSQLと説明書だけ。本番用config.js/既存supabase-schema.sql/データ/公開画面は変更しない。
- このSQLは新しい空テーブルを作る検証用。本番移行SQLではない。
- 本番ではpulse_matchesが存在するためCREATE TABLEが失敗する防護はあるが、それに頼ってプロジェクトを選ばない。
- GitHub未接続のままでよい。SQL適用にGitHub連携やPages公開は不要。
- 既存の匿名書込停止を再開しない。本番のRLS・GRANT・反応データには触れない。
