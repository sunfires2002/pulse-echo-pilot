# 短縮URLの読取時変換（公開情報保護LAB）

2026-11-04。対象は `codex/public-information-protection-lab` のみ。
本番DB、main、PRISM CUT、元の動画URL、試合ID、既存反応・反応時刻は変更しない。

## 変換仕様

- 公開関数の読取時に11文字のYouTube IDへ正規化する。原本の保存値は更新しない。
- 対象は既存の11文字ID、および `https://youtu.be/<ID>`（www、query、fragmentも可）。
- 余分なパス、別ホスト、認証情報、ポート指定、HTTP、無効ID、非文字列、長すぎる入力は不正扱い。
- 本番で未使用のwatch/embed等の形式は今回追加しない。新形式は管理者の不正件数に計上する。
- query内の時刻指定を反応時刻へ足す等の補正はしない。動画の0秒基準と前後半の対応を維持。
- 不正値は公開フィールドでNULL。公開行自体や他の有効な動画は削除しない。
- 無言で除外せず、`privacy_lab_video_audit()` が項目別の総数・空欄・変換成功・不正件数を返す。

## 管理者向けの件数報告

**今回はSQL Editor管理者専用。通常の管理画面に新しいUIは追加していない。**
次のSELECTは件数だけを返し、元のURL・試合ID・動画ID・担当者・内部情報は返さない。

```sql
SELECT * FROM public.privacy_lab_video_audit();
```

anon/authenticatedの集計関数・変換ヘルパー実行権限は撤去する。
公開関数の所有者には変換ヘルパーの実行だけを許可。
原本SELECT拒否、公開true限定、公開12項目、読取専用ロールとRLSは維持する。
集計対象は今回の専用原本 `privacy_lab_matches`。既存のadmin-safety表や本番表は変更しない。

## SQL適用順序（検証プロジェクトだけ）

- 既存LAB: `sql/public-privacy-video-conversion.sql` → `sql/public-privacy-video-verify.sql`。
- 新規LAB: `sql/public-privacy-lab.sql` → 上記2ファイル。
- 旧後半サンプルを既に適用した場合: `sql/public-privacy-video-sample.sql` で架空試合1件の動画だけを差し替える。
- 更新SQLは一度だけ全文実行。不明なエラー時は再送せず確認する。適用前のLABマーカーを検査する。
- SQL Editorの権限で適用する。秘密キーやユーザーパスワードは不要。
- cleanupは今回専用の関数と表・ロールだけを撤去し、匿名権限を再開しない。

## 本番の読み取り検査

実装したPython側の同等変換処理を使い、本番の動画3項目だけをGETで全件検査。
原本の値は保存・出力せず、総件数とレスポンスの件数を比較して全18試合を確認。

| 項目 | 変換成功 | 不正 | 未設定 |
| --- | ---: | ---: | ---: |
| firstHalfVideo | 10 | 0 | 8 |
| secondHalfVideo | 10 | 0 | 8 |
| highlightVideo | 1 | 0 | 17 |
| 合計 | 21 | 0 | 33 |

本番URLを検証用DBへコピーしていない。本番の実動画21本を全再生したという意味ではない。
SQLでの変換・再生試験には架空試合と公開サンプル動画を使う。

## 検証記録

- Python単体テスト8件PASS（既存の配信・原本保護チェックを含む）。
- ユーザーが検証用SQL Editorで実行: 変換15ケース成功、失敗0、その他の確認項目すべてtrue。
- DB内の架空短縮URL2件がIDに変換され、意図的な不正形式1件が管理者集計に出る。
- 公開12項目、原本SELECT拒否、非公開行の遮断、anon/authenticated集計実行拒否を確認。
- 旧後半サンプルは実YouTubeでエラー150。ID変換ではなく埋め込み制限のため、公開サンプルへ差し替え。
  参考: https://developers.google.com/youtube/iframe_api_reference （onError 101/150）。
- ローカル短縮URL版＋実YouTube: 前半/後半の再生、切替、15秒/25秒へのシーク成功。誤差は両方0秒。
  RPC通信なし、本番接続なし、DB書き込みなし。詳細は無視対象の `evidence-public-privacy/`。
- 実検証用RPC＋最終サンプル: 前後半とも実YouTube再生・切替・シーク成功。誤差は両方0秒。
  公開関数GET 2件、遮断対象リクエスト0、ページ例外0、DB書き込み0。
- 実APIの追加試験6項目PASS: 公開12項目、短縮URL変換と不正値のNULL化、管理者集計/ヘルパーの匿名実行拒否、
  非公開/不正公開状態の遮断、原本SELECT拒否、workflow列取得拒否。すべてGETのみ。
- 最終サンプルでのローカルChrome回帰: ホーム320/390/800/1440px、PC1280x720/1920x1080、
  TV相当1280x720、スマホ390x844の8ケースPASS。PULSEクリック・REACT・合体分離・保存復元、
  エラー/0件/不正応答での旧データ再表示防止も確認。

## 実行と確認URL

ローカル模擬版: `http://127.0.0.1:8084/`。
検証用Supabase版: `http://127.0.0.1:8085/`。
両方とも反応はブラウザー内の架空データだけ。管理者集計はHTTP配信しない。

```
python3 -m unittest discover -s tests -p 'public_privacy_*.py'
python3 tools/privacy_videos.py
python3 tools/check-public-privacy-live.py --config-file <所有者限定の検証用設定ファイル>
node tests/public-privacy-live-browser.cjs
node tests/public-privacy-browser.cjs
```

## 残る課題

本番採用は未決定。本番の実原本に対するロール・関数・管理者経路の設計と移行、
公開配信の切替、実端末Safari/Android/Fire TV、将来の新URL形式への対応は別途判断。
管理者画面での自動通知は今回未実装（SQL Editorの件数確認方式）。
YouTubeの埋め込み許可や公開状態はID変換の成功とは別に確認が必要。
