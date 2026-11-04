# 公開情報保護LAB 検証結果（2026-11-04）

- 基点: `dcca8e78d25537f1c8107f51ce88a4914a6f6fb2`。
- 公開境界/再混入/旧fallback/接続先拒否のPythonテスト: 4件PASS。
- allowlistビルド: 25ファイル。内部バックアップ・data.js・管理画面・設定私有ファイルを除外。
- 7種の非配信パスをHTTP404で確認。
- ローカルChrome: ホーム320/390/800/1440px、0件/通信503/不正応答/非公開ID/
  旧localStorage・window.PULSE_MATCHES残存時の再表示防止を確認。横スクロールなし。
- 模擬動画: PC1280x720/1920x1080、TV相当1280x720、スマホ390x844。
  前後半切替、PULSE/REACT、端末メモリ内反応追加、動画再生停止シークを確認。
- PC: 移動・保存復元・合体→再読込→復元→分離、グラフクリックシークを確認。
  既存の秒切り捨てにより300秒指定位置が299秒となるケースを確認（1秒以内）。
- 検証Supabase匿名実API: GETのみ。公開2件/固定12項目、非公開IDと文字列公開状態の除外、
  専用原本へのSELECT拒否、workflow列取得拒否がPASS。DB書き込み0件。
- SQL Editorのユーザー提供結果: summaryの18項目すべてtrue。
  authenticatedロールの公開限定関数結果true。これはSQLロールでの確認で実JWT HTTPではない。
- 実検証RPC＋実YouTube: 再生成功、15秒シークの誤差0秒、グラフ表示、サンプル反応、PCアイコン4種。
  RPC GET 2件、遮断対象リクエスト0件、ページ例外0件、DB書き込み0件。
  初回はテスト待機式が準備前の変数を読みReferenceError。テストだけ修正し再実行成功。
- 本番接続・書き込み0件。main・本番権限・PRISM CUT・既存LABの変更なし。

証拠: 無視対象 `evidence-public-privacy/browser-results.json`、`live-browser-results.json`、各PNG。
テストデータ4件は検証専用テーブルに残し、確認URLから引き続き試せる。
撤去する場合は専用cleanup SQLを検証用SQL Editorで実行する。

## 正式移行前に必要

- 実際のpulse_matchesを対象にした原本遮断・管理者権限・既存動画URL正規化の検証。
- 公開ビルド方式の切替承認（現在の本番mainルート配信ではLABのallowlistは有効にならない）。
- 実端末Safari/Android/Fire TV、認証済み非管理者JWTでのHTTP確認。
- 非公開化後に既に開かれたページ、反応APIの公開範囲、旧配信/Git履歴/取得済み情報の扱い。

この結果は本番への適用や公開を承認するものではない。
