# TV GOALクリック不発の最小修正（独立LAB、未公開）

> 履歴資料: 旧 `codex/tv-goal-click-fix` / `8fdc114` から選択複製した旧検証記録です。以下の旧環境URL・旧コミット・旧実行結果は現在の `codex/tv-goal-db2004-lab` の検証結果を示しません。新LABで今回実行した結果は作業報告と情報保護状態表に分けて記録します。

## 基点・範囲

- 基点：統合LAB `ae7a524b95a853d6f7d345e2e81c0620282fb7a3`
- 診断参照：`f9fd11610da2ff25c2c013480fba9df448c233b8`
- 修正ブランチ：`codex/tv-goal-click-fix`
- main98372f6・完成済みGOAL206df8c・統合ae7a524・診断f9fd116は変更しない。
- 実装変更はtv-goals.js。pc-desktop.jsのGOAL JS読込を0.1.4、match.htmlのloaderを1.2.23へ更新。GOAL CSSは未変更。

## 修正

1. `layer.replaceChildren()`を廃止。試合/前後半/動画とGOAL番号を照合し、既存のボタン・ボール・装飾枠を再利用する。座標、ラベル、件数バッジだけを更新する。
2. 押下中の要素を先に確保し、近接グループの合体・分割でもそのボタンを再利用する。通常は先頭GOALの同じキー、構成変更時は共通GOALを持つ要素を再利用する。DOM順も時刻順を維持し、押下中の要素は移動・再appendしない。
3. ポインター押下中は利用可能ならpointer captureで押し始めた要素への解放イベントを維持する。座標が移動しても操作を取りこぼさない。押下時と現在の両領域の外へドラッグして離した場合はシークしない。keydown/keyupでも押下要素を維持する。click成立前に押下状態を解除しない。
4. ボタンはクリック時点の最新グループを参照する。試合/動画の一致と、現在までのGOALであることを再検証し、D案どおり最初のGOALの10秒前へ1回だけシークする。pointerdownへのシーク移動・自動リトライ・追加の再生操作はない。
5. 動画/前後半切替、取消、シークで未来になった場合など、無効なボールは押下中でも除去する。これは正当な非表示であり、無効になったGOALへはジャンプしない。

16pxボール、36×32pxヒット領域、26×22px枠、赤い秒軸、件数バッジ、最大60秒の近接条件、10秒前、小数秒、未来非表示、prism-goals/1を維持。tv-view/REACT/名前設定/PC自由配置/投稿/データ/スキーマは変更なし（16ファイルをバイト照合）。

## 検証結果

Chrome＋Silk相当UA。Fire TV物理リモコンの証明ではない。試合・反応・GOALは架空の検証データ、本番通信を無効化/遮断。

| テスト | 最終結果 |
|---|---|
| 以前30/30不発だった押下中の別GOAL追加（単独/近接、960×540/1280×720/1920×1080、各5回） | **30/30で初回成功**。押下した同じDOM要素を維持。各回でGOAL受付1回、seekTo1回、getCurrentTime反映を別記録 |
| 同3サイズ、模擬Playerの再生/停止/バッファ中、focusあり/なし | 36/36で初回成功 |
| Enter/Spaceの通常操作 | 12/12成功 |
| 近接2件→3件を押下中に追加 | 3/3で初回成功 |
| 押下中のグループ合体・分割 | 各サイズ・単独/近接の各6ケース、計12ケースで押下DOM維持、最新グループの最初のGOAL−10秒へ1回でシーク |
| Spaceキーを押している間のGOAL追加 | 全6ケース成功 |
| 押下中にシークして対象が未来になる | 全6ケースで非表示、ジャンプなし |
| 領域外へ動かして離す | 全6ケースでジャンプなし |
| Chromeカーソルの画面外→再進入、別ボタンからfocus移動 | 全6ケースで初回成功。Fire TVの白丸消失/復帰自体は未検証 |
| 実YouTube、再生中/停止中、通常クリック | 12/12で初回成功 |
| 実YouTube、299秒台で押下→再生が300秒を超えて新GOAL追加→解放 | 単独2回・近接2回の**4/4で初回成功**。各回GOAL受付1回・seekTo1回・時刻反映あり |
| tests/tv-goals.cjs | TV3サイズで全PASS。ボール/枠の寸法と中心、秒軸/凡例/下端、単独/近接/始端/終端/小数秒、未来非表示、GOAL訂正/取消/動画照合、通常PULSE、REACT、端末内投稿、前後半とホーム維持 |
| tests/tv-react-list.cjs | TV3サイズで追従・未来除外・開閉・コメントジャンプPASS |
| tests/tv-v1-profile.cjs | TV3サイズで初回フォーカス・スキップ・名前変更・キャンセル・ゲスト・送信者ID保持・ホーム往復と別試合・reload PASS |
| tests/tv-integration-scope.cjs | 通常PC1280/1920/2500、iPhone/Android縦横、Androidタブレット、iPad縦横の10ケースでmainと同じ表示/座標/アイコン/名前/保存sentinelを確認 |

実YouTubeの命令は単独120.5→110.5秒、近接120→110秒。最終ソース試験でその後の再生位置は単独111.027/110.881秒、近接110.501/110.375秒（再生が進んだ時刻）。ログ中に目標時刻の反映を別記録し、PLAYING状態も待機した。時刻反映はYouTube getCurrentTime基準で、映像フレームの独立計測ではない。

本番Supabase HTTP/WS 0件、実投稿0件、未処理例外0件。名前・送信者ID・コメント本文を診断ログへ含めない。反応投稿の回帰確認は空backendで端末内に限定。

## 再実行

ソースのルートをループバックHTTPで配信し、Playwright/Chromeを使う。2つの新規テストは空config・架空試合データ・診断observerをテスト内で挿入する。診断observerはtests/helpers配下で、通常画面へは読み込まない。tv-goals.jsの任意の観測フックはobserverなしでは保存/表示しない。

```
GOAL_DIAG_URL=http://127.0.0.1:8070/ GOAL_DIAG_OUT=/absolute/evidence node tests/tv-goal-click-fix.cjs
GOAL_FIX_URL=http://127.0.0.1:8070/ GOAL_DIAG_OUT=/absolute/evidence/youtube node tests/tv-goal-click-fix-youtube.cjs
```

証跡：`../tv-goal-click-fix-evidence/final-regression/`（30回と拡張条件）、`source-youtube/`（実動画）、`goals/`、`react/`、`profile/`、`scope/`、`unchanged-files.json`。比較元の不発結果は `../tv-goal-click-evidence/unmodified/`。

## Fire TV修正版LAB

- URL：`http://192.168.0.16:8069/?mode=tv&goalLab=1`
- フォルダー：`/Users/momo/Documents/ChatGPT/PULSE ECHO 開発室/TV-GOAL-click-fix-preview`
- 8065/8067/8068は変更せず、8069専用の名前・端末内反応領域を使用。既存の保存設定は削除しない。
- サンプルA：単独、B：近接。2:10付近へ進めて、再生中/一時停止中の1回の決定でジャンプするか確認する。
- 白丸が消えた後は、決定だけで復帰する場合、いったん移動してボールを選ぶ場合を比較する。白枠だけではクリック受付を意味しない。
- 修正版プレビューだけに左上カウンターを置き、受付・命令・時刻反映をMac内のreceived.jsonlへ記録。PULSE等の命令も命令数に入るため、押下前後の増分とGOAL受付を照合する。名前/送信者ID/入力文字は記録しない。
- Mac起動中・同じWi-Fi。再起動は当該フォルダーで `python3 serve.py`。

## 残る確認

Fire TV Silkの物理リモコン、白丸カーソル消失後の最初の操作、pointer captureの実機挙動は利用者確認待ち。Chromeの再進入テストを実機確認済みとは扱わない。再現したDOM再生成競合の回帰は解消したが、Silkがカーソル復帰用に最初の操作を消費する可能性まで修正・断定したものではない。

既存の「長時間動画への密集GOALでは別グループの操作領域が重なる場合がある」制約は今回変更していない。実PRISM CUT JSONと映像内の本当のGOAL時刻の照合も今回の検証に含めない。mainへの反映・正式公開は未実施、正式採用は実機結果を確認してから判断する。
