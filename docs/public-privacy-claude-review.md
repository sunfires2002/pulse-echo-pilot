# 公開情報保護LAB：レビュー対応・移行設計

調査日: 2026-11-04。今回は調査・設計とLABブランチのpushのみ。
公開用関数方式の本番採用は未決定。本番DB・main・PRISM CUTは未変更。

## 確認した基点とpush

- 正式main: `dcca8e78d25537f1c8107f51ce88a4914a6f6fb2`。
- LAB実装: `6353ebb3db5c0ed71d70ff530e9eb002937a03fa`。
- `codex/public-information-protection-lab` をGitHubへpushし、同SHAを確認。
- NO DEPLOYチェック成功: Actions run `41747526474`。
- 本追記は調査報告だけで、公開関数・フロント・権限SQLは変更しない。

## 公開関数の全12項目

`id`, `date`, `competition`, `round`, `home`, `away`, `homeScore`, `awayScore`,
`firstHalfVideo`, `secondHalfVideo`, `highlightVideo`, `published`。
動画3項目はURLではなく、対応するYouTube IDを返す設計。
workflow・担当者名・素材URL・内部メモは返却しない。

## 本番18試合の動画項目：読み取り専用の全件検査

本番の公開APIへGETのみ。ページ上限と総件数を比較し、18件すべてを取得したことを確認。
取得対象は試合IDと動画3項目に限定。元の値・試合ID・動画IDは保存せず、集計だけを記録。

| 項目 | 設定あり・変換可能 | 未設定 | 変換失敗 |
| --- | ---: | ---: | ---: |
| firstHalfVideo | 10 | 8 | 0 |
| secondHalfVideo | 10 | 8 | 0 |
| highlightVideo | 1 | 17 | 0 |
| 計 | 21 | 33 | 0 |

- 全18試合が少なくとも1本の動画を持つ。
- 設定済み21項目はすべてHTTPSの正規YouTube短縮URL。
- ホスト、11文字ID、余分なパス・認証情報・ポートなしの厳密条件をすべて通過。
- 時刻指定パラメーターを含むURLは0件。独自の時刻補正は不要。
- 動画IDは19種類、同じIDの再参照は2件。削除・統合・ID変更は行わない。
- 変換失敗0件、隠した失敗なし。ただし再生可否・動画公開状態・所有権の検査ではない。
- **現LAB SQLは11文字IDのみを受け付けるため、本番の短縮URLをそのまま渡すとNULLになる。**
  読取時のURL→ID正規化を別途実装・検証することが本番採用の必須条件。
  本番の保存済みURLや既存反応の時刻は更新しない。

## pulse_matches参照の棚卸し

### 正式版main（全追跡コードの検索）

| ファイル | 実処理 | 移行時の扱い |
| --- | --- | --- |
| index.html:58 | 原本 `id,data,updated_at` SELECT | 公開読取へ切替 |
| match.html:129 | 同SELECT、全画面モードで共有 | 公開読取へ切替。PC/TV/スマホごとに回帰 |
| admin.html:323 | 同SELECT、旧全件upsert/削除も存在 | 原本は管理者認証・管理者限定RLS経路のみ。旧保存経路は再開しない |
| config.js | テーブル名と接続先の定義 | 呼出処理そのものではない |
| tests/common-profile.cjs, tests/profile.cjs | テーブルのモック | 本番読取ではないが旧fallback依存を更新する必要 |
| tests/pc-release-live.cjs | 本番読取の観測/assertion | 公開関数経路に合わせる必要 |
| supabase-schema.sql | 古い権限定義 | 再実行禁止。匿名権限を戻さない |

PC・TV用JSは独立して試合原本を読まず、match.htmlの読取結果を使用する。
全34ローカルブランチも検索。多くの旧LABに同じindex/match/admin参照が残る。
admin-safety-labはadmin-safety-backend.jsと専用テストツールから原本を扱うが、
接続設定は検証用であり、この移行で既存LABの権限やコードを変更しない。
作業室の既知プレビューと旧role-workflow-v3にもコピーが残る。
これらはコード上の参照であり、現時点の本番通信実績の証明ではない。

### 関連公開リポジトリ6件・コード43ファイル

各mainの再帰ツリー（省略なし）を取得し、HTML/JS等のコード43ファイルを調査。読取失敗0。
SUNFIRES/8motion/realtime-test等の実配信ファイルがGitHubの内容と同じこともGETで確認。

| リポジトリ | 調査結果 |
| --- | --- |
| SUNFIRES | index.htmlのPULSEリンク4本。埋め込み・Supabaseクライアント・原本参照なし |
| 8motion-Match-Center | index.htmlのPULSEリンク1本。原本参照なし。admin.htmlにも対象参照なし |
| sunfires.admin | 対象テーブル・PULSEリンクなし |
| pulse-echo-lab | index/matchに旧SELECTコードは残るが `const supa=null`。本番読取経路は実行されない |
| pulse-echo-realtime-test | rootとteam-roomsのconfigは本番接続先を保持するが、試合のcloudMatchesは静的window.PULSE_MATCHESを返す。テーブル名定義は未使用。実DB経路は反応用で、今回の原本SELECT停止による直接影響とは区別 |
| pulse-voice-test | 対象テーブル参照なし |

調査コミット:
- SUNFIRES `6c8fd73501cb11fe1197e3dc62fd324622a49058`
- 8motion-Match-Center `956ec8e3388ba21a7b8cbc067498505c4bb40425`
- sunfires.admin `0d4b70e9e7f3cd60ec3575e4742cb6151b6b9573`
- pulse-echo-realtime-test `13f95cb85e9d22f59496ebe740c311eb2017823d`
- pulse-echo-lab `c8fa302ddd2a98d0344680d13feac19347e45f30`

これは確認可能な関連リポジトリ・ローカルコピーの棚卸し。
非公開の別サイト・第三者クライアント・取得済みファイル・実アクセス履歴の網羅は未確認。
静的な外部テストデータの公開項目監査も、直接SELECTの調査とは別に必要。

## 本番採用を判断するための段階的移行案（未実行）

1. **準備と採用判断**
   - URL正規化、実際のpulse_matchesスキーマ、全公開項目、原本を読める別RPC/ビューも検証。
   - 本番用管理者認証・本人限定RLSと公開読取ロールを設計。anonに原本SELECTは許可しない。
   - authenticated全員へ原本を公開しない。管理者経路には本人限定ポリシーを適用する。
   - メタデータ/データの保管先を公開領域外に確保。復旧用の権限定義も安全側のものだけを用意。
2. **独立した先行対策**
   - 別承認後、内部バックアップの撤去と公開成果物の許可リスト化を先行可能。
   - 旧URL404・再混入検査を確認。Git履歴や取得済みコピーが消えるとは扱わない。
3. **本番用読取経路の準備**
   - 別承認後、原本を変更しない読取専用関数を用意し、許可12項目・公開trueだけを検証。
   - 動画URL→IDは読取時に変換。既存URL/試合ID/反応キー/時刻は変えない。
   - 未対応形式は無言で捨てず、内部値を含めない管理向け検出結果を確認してから切替。
4. **切替を短い管理された作業枠で実施**
   - まず承認された新フロント（RPC・fallbackなし）を配信し、canaryで表示を確認。
   - 直後に原本の匿名SELECT/PUBLIC由来の経路を閉じ、一般authenticatedも取得不可にする。
     管理者は本人限定RLSを通す経路だけを維持。匿名IUD・不要6権限は停止を維持。
   - 準備期間に既存の匿名原本読取が残っている間は「保護完了」と判定しない。
   - 旧タブ・旧キャッシュの画面は原本取得拒否で失敗し得る。安全性を優先し、再読込を案内する。
5. **切替後の確認**
   - 匿名/非管理者の原本拒否、非公開ID不可、許可項目限定、公開解除・通信失敗・正常0件を確認。
   - SUNFIRES/8motionの既存リンク、PC/TV/スマホ、動画前後半、PULSE/REACTと既存反応を確認。
   - 管理者のみ保存可能であることは別枠で確認し、無断の本番テスト投稿は行わない。
   - エラー率とアクセスログを監視する。ただし個人情報・URL・トークンを報告へ出さない。

## 匿名SELECTを復活させないロールバック

- 配信物は**保護対応済みの安全な直前版**だけに戻す。現在の旧mainへ単純巻き戻しはしない。
  旧mainは原本SELECT/fallbackを復活させるため、安全な復旧先ではない。
- 関数の不具合は、同じ公開12項目・公開条件・最小権限を維持した安全な関数定義に戻す。
- 漏えいの疑いがあれば関数の一般実行を停止し、一時的な案内画面にする。
- 原本の匿名SELECT、匿名IUD、不要6権限は閉じたまま。旧静的データやlocalStorageへ戻さない。
- 管理画面側の問題は保存を停止し、読取専用状態に戻す。匿名書き込みで復旧しない。
- futsal_goodsの権限・既存データは変更しない。PRISM CUTも変更しない。

## 本番移行の残課題

公開関数の本番採用判断、URL正規化の実装/LAB検証、実原本の最小権限、
公開ビルド切替、外部未把握利用者、実機、公開解除後の既開封ページ/キャッシュ/履歴、
反応APIと外部静的テストデータの公開範囲は未完了。
