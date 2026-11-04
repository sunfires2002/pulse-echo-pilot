# 公開情報保護LAB（自動公開なし）

基点: 正式版main `dcca8e78d25537f1c8107f51ce88a4914a6f6fb2`。
ブランチ: `codex/public-information-protection-lab`。
本番DB、main、既存のadmin-safety LAB、PRISM CUTは変更しない。

## 起動

- ローカル架空データ: `python3 tools/serve-public-privacy-lab.py --port 8084`
- 実検証用RPC: `python3 tools/serve-public-privacy-lab.py --port 8085 --config-file <既存の所有者限定 .admin-lab.private.json の絶対パス>`
- `http://127.0.0.1:8084/` / `http://127.0.0.1:8085/`
- 例: `match.html?id=privacy-sample-a`。TVは `&mode=tv`。

接続設定は既存の所有者限定ファイルを読み取るだけで、コピー・保存しない。
接続先のproject ref SHA-256を固定し、他のプロジェクト・secret/JWTキーを拒否。
管理者UUIDは公開画面に配信しない。CSPも検証プロジェクトだけを許可。
反応データはどちらのサーバーでも注入するLAB専用アダプターのメモリ内だけ。
実Supabaseの `futsal_goods` には接続しない。名前・レイアウトは別ポートのブラウザー領域のみ。

## データと権限

`sql/public-privacy-lab.sql`、続けて `sql/public-privacy-video-conversion.sql` をユーザーが検証用SQL Editorで適用する。
本番に存在しないadmin-safetyの制約・トリガーを前提とするガード付き。
専用原本 `public.privacy_lab_matches` と専用関数 `public.public_privacy_matches(text)` を作成する。
**既存LABの `public.pulse_matches` のGRANT・RLSは変えない。今回の遮断試験は専用原本が対象。**

関数所有者 `pulse_privacy_lab_reader` はNOLOGIN/NOBYPASSRLS、原本SELECTのみ。
原本はRLS＋FORCE RLS、所有者用の公開済み限定SELECTポリシー。
関数はSTABLE/SECURITY DEFINER/空search_path/完全修飾、固定列・型だけを返す。
PUBLICのEXECUTEを撤去し、anon/authenticatedに関数実行だけを許可。
元のJSONや任意のカラム名を引数として受け取らない。SQLは固定で動的SQLなし。
所有者の書き込み権限なし、STABLEによる読取専用実行、匿名直接SELECT拒否を重ねる。

返却項目: id/date/competition/round/home/away/homeScore/awayScore/
firstHalfVideo/secondHalfVideo/highlightVideo/published。
動画フィールドは前半・後半・ハイライトに対応する11文字のYouTube IDだけ。
`published`はJSON boolean trueだけ。文字列"true"は対象外。
workflow・担当者名・素材URL・メモを含む架空原本を用意し、返却されないことを確認する。

読取時の短縮URL→ID変換は `sql/public-privacy-video-conversion.sql` に追加。
管理者の件数集計はSQL Editor専用（一般クライアントからは実行不可）。
詳細・最新結果は `public-privacy-video-conversion.md` を参照。本番への適用は未実施。
許可リスト外のvenue/description等は表示しない。追加するなら公開判断が必要。

## 配信境界

`tools/public_privacy_files.py --build` は25ファイルだけを `dist-public/` に出力。
管理画面・SQL・テスト・設定私有ファイル・data.js・内部バックアップは対象外。
元の追跡済みバックアップをこのブランチから削除。JSONバックアップの再混入でビルドを拒否。
公開HTMLへの旧fallback再追加・公開ファイル内の内部マーカー/秘密キーも拒否。
config.jsは未接続LAB設定に固定し、実接続用の値を配信成果物へ書き出さない。
この成果物は未接続のレビュー用で、本番にそのままデプロイしない。
CIはチェックだけ。Pages deployジョブ・権限なし。

GitHub Pagesの本番は現在mainのルート配信。許可リストは**今回のLABサーバーとビルド成果物**に適用。
本番の配信方式は変更していない。正式移行時は承認された許可リスト成果物を公開する手順が必要。
ファイル削除はGit履歴・取得済みコピーの消去を意味しない。

## 画面の読込

ホーム・視聴ページは同じpublic-matches.jsを利用。
DB0件は空表示、通信/権限/JSON形式エラーは再試行表示。キャッシュなし、credentials omit。
管理用localStorage、data.js、window.PULSE_MATCHESは一切参照しない。
エラー時は動画を生成せず、PCが再配置したパネルも非表示にする。
入力された試合IDをそのまま関数の引数に渡し、URL・ID・反応のvideo_id規則は維持。
名前と自由配置の既存保存キーは削除・書換えしない。

## 検証コマンド

```
python3 -m unittest discover -s tests -p 'public_privacy_*.py'
python3 tools/public_privacy_files.py --build
node tests/public-privacy-browser.cjs
python3 tools/check-public-privacy-live.py --config-file <所有者限定設定ファイル>
node tests/public-privacy-live-browser.cjs
```

ブラウザーテストにはPlaywrightとChromeが必要。証拠は無視対象の `evidence-public-privacy/`。
mock版: 320/390/800/1440ホーム、PC1280x720/1920x1080、TV相当1280x720、スマホ390x844。
DB0件/503/不正JSON/非公開ID/旧端末データ、読込失敗の直接URL、7種の配信拒否、
動画切替・PULSE・REACT・メモリ内投稿、PC移動/保存復元/合体分離を確認。
実版: 検証用RPC + 実YouTubeの再生・15秒シーク。
匿名実APIはGETのみで原本SELECT拒否・workflow列拒否・非公開/不正公開状態の非表示を確認。
SQL Editorで実行した確認結果はユーザー提供の証拠として区別する。

## 残る確認と移行

- 実iPhone Safari/Android/Fire TV、実ネットワークの長時間動作。
- 認証済み一般ユーザーの実JWTによるHTTP試験（SQL role試験は実施）。
- 本番pulse_matchesの権限・既存URL形式・関数の読み取り性能・管理者専用経路の適合。
- 公開解除後に既に開かれているページ、既取得キャッシュ、Git履歴からの回収は保証しない。
- 反応APIからの非公開情報取得は別途監査。反応APIの本番権限は今回対象外。
- 本番移行は別承認。公開関数・原本遮断・フロント切替・バックアップ撤去を一連で検証する。
- 障害時は公開経路を修復/停止。旧fallbackや匿名原本SELECTを復活させない。
- 検証専用構成の撤去は `sql/public-privacy-lab-cleanup.sql` をユーザーが検証用だけで実行。
  既存LABや本番の匿名権限は再開しない。
