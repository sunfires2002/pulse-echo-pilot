# PC ECHO追加オプション LAB（未公開）

## 基点と範囲

最新mainをfetchし、98372f641e85141b239385ca75d08bc08cfb892bとcleanを確認。専用ブランチはcodex/pc-echo-options-lab。main・TV完成LAB・REACT/GOALタブLAB・PRISM CUTは変更しない。

`echoOptionsLab=1`を明示したPC自由配置だけで有効化。標準/TVへ切り替えた場合は元の配置・文言へ戻す。スマホは実験モジュールを読み込まない。

## 調査した元の投稿仕様

元のmatch.htmlは、メインボタンを押した時点でaddEventへ1件投稿する。ナイスのオプションを選択すると、ナイスシュート等の既存kindをさらに1件投稿する。閉じるだけなら最初の1件が残る。タイミングは各押下時のnowTime(3)。

この投稿/保存処理は変更していない。match.htmlのbody以降はmainとバイト一致。変更はエントリJSの読込バージョンだけ。

## 実装

- 既存niceOptionsのDOM・ボタン・data-kind・onclickをそのまま使用し、PC実験時だけECHO内のトレイへ移す。別の固定ポップアップは開かない。
- ナイスの表示だけシュート/キーパー/パス/守備へ短縮。通常モードへ戻ると元の長い文言を復元する。
- 既存メインボタンの種類・表示文言・並び・幅112px/高さ40pxを維持。元から非表示のAIボタンは表示しない。
- 720px幅ではECHO見出し右側の余白へ1段で表示。反応バーにはリサイズボタンがなく、不要な下余白を開いている間だけ使うことで、**高さ114pxのまま**表示する。
- 幅が足りなければ2段へ。420px幅の試験ではECHOだけ高さ237pxへ展開。文字14px・選択ボタン32px以上を維持し、他のパネルや動画/PULSEの座標を変えない。
- 開いたままドラッグ可能。トレイはECHOの子要素なので一緒に動く。画面端ではECHOの一時表示位置を補正し、閉じると元の寸法へ戻す。開いた高さを保存済みレイアウトへ書き込まない。移動操作自体は元の保存処理を使う。
- 合体中はPULSEを動かさずECHOの元の枠を維持。幅不足時はECHO内スクロールへ切り替える。分離ボタンと閉じるボタンの場所を分ける。
- ×/Escapeで閉じる。候補を選ばなくても既存メイン投稿は残る。

候補はpc-echo-options.js冒頭のdefinitionsにまとめた。表示中4反応は、ナイス4種、惜しい（シュート/パス/あと一歩）、あちゃー（空振り/すれ違い/ドンマイ）、マジで（スーパー/びっくり/まさか）。非表示AIも気になる/あとで確認の定義だけ用意するが、ボタンの非表示方針は変えない。候補は仮案。

## 実験データの分離

ナイスは元の追加投稿処理・既存kindを維持する。

**他の仮オプションはaddEventや通常eventsへ入れない。** ページ内の独立配列へexperimental/parent_kind/option_id/label/good_time/video_idとして記録し、[LAB]付きで既存のECHO表示へ流す。新しいkindやコメントをSupabaseへ送らず、通常のREACT一覧や反応集計にも混ぜない。元のメイン反応の1件投稿はそのまま残る。

参照はPULSE_ECHO_OPTION_EXPERIMENTS.rows()、clear()。実験履歴はページ内だけで、再読み込みでリセットする。名前や送信者IDを別に生成しない。

専用プレビューは空config・Supabase SDK撤去・CSP connect-src self。通常の試験投稿は8077のlocalStorageだけ、仮オプションはメモリーだけ。本番の保存領域や旧LAB設定を削除/上書きしない。

## 変更ファイル

- pc-echo-options.js/css：候補定義、ECHO内配置、サイズ/画面端追従、実験配列。
- pc-lab.js：既存ポップアップを実験時だけトレイへ分岐。移動開始時に実験トレイを閉じない。標準/TVで元へ復元する。
- pc-desktop.js：PC＋echoOptionsLab=1だけで実験JS/CSSをロード。pc-lab.jsを1.2.5へ更新。
- match.html：pc-desktop.js読込を1.2.24へ更新。投稿ロジックは未変更。
- tests/pc-echo-options.cjs、pc-echo-options-dock.cjs、この文書。

profile/home-profile/profile-dialog/style/pc-lab.css/pc-video-controls/tv-view/config/data/schemaの12ファイルはmainとバイト一致。

## 検証

Chrome実ブラウザー、1280×720・1920×1080・2500×928で実行。

| 項目 | 結果 |
|---|---|
| 開いたまま上下左右へドラッグ | トレイとECHOの相対位置維持、パネル内に収まる PASS |
| 画面四隅 | 全候補/閉じるの矩形がパネル/画面内に収まる PASS |
| メイン反応ボタン | 追加前/後で種類・文言・寸法・文字サイズ一致 PASS |
| 文字と幅不足 | 14px維持、420px幅では2段・高さ237px、見切れなし PASS |
| 他パネル | 動画/PULSE/ECHO+/REACTの座標・寸法一致 PASS |
| 閉じるだけ | メインの1件投稿を維持 PASS |
| ナイス選択 | 元のナイスシュートkindの追加投稿・127秒（130−3）を確認 PASS |
| 他反応の候補 | 元のメイン投稿だけeventsへ入り、仮候補は別配列へ入る PASS |
| 非表示AI | 表示は変えず、テストのdispatchEventでデータ分離のみ検査。実クリック済みとは扱わない |
| 合体→reload→保存復元→分離 | PASS。開いてもPULSE位置は不変、×と分離の非重複確認 |
| PC→標準→PC | 標準で元の長いナイス文言へ戻り、PC実験で短縮表示へ復帰 PASS |
| 標準PC・TV Silk相当・スマホ相当 | 実験クラスなし、追加前と動画/グラフ/操作部分の寸法一致 PASS |

本番Supabase HTTP/WS 0件、実投稿0件、未処理例外0件。元の投稿は空backendの端末内で検証。名前と送信者ID・別設定のsentinelは維持。

証跡：../pc-echo-options-evidence/final/（3画面サイズの前後/四隅/幅420）、dock/（合体復元）、real-results.jsonおよび*-real-before/after.png（実YouTube）、unchanged-files.json。

## Mac Chrome確認URL

`http://127.0.0.1:8077/match.html?id=echo-options-sample&echoOptionsLab=1`

追加前比較は末尾をechoOptionsLab=0へ変更する。

専用フォルダー：`/Users/momo/Documents/ChatGPT/PULSE ECHO 開発室/pc-echo-options-lab`。再起動はそのフォルダーでpython3 serve.py。既存のTV/GOAL/チュートリアル/REACTタブLABのポートは変更しない。

メインを押してから各候補を選び、移動/閉じるを比較する。仮オプションは[LAB]付き表示で、通常REACTに2件目を追加しないことが意図した仕様。候補文言や種類は今回確定しない。

## 未確認事項

Safari等の別ブラウザー/スマホ・TV実機は未検証。対象外モードの回帰はChromeのUA/viewport比較。実際のMac Chromeでの手動操作感・透明度と動画の重なりは利用者確認待ち。本番Supabaseへの投稿テストは行わない。正式main統合・公開は未実施。
