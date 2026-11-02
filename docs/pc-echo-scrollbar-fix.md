# PC ECHO不要スクロール修正（未公開LAB）

## 基点・変更範囲

- 専用ブランチ `codex/pc-echo-scrollbar-fix`、基点 `7c461a1`。
- fetch後のmain/origin/mainは `98372f641e85141b239385ca75d08bc08cfb892b`。作業ツリーは開始時clean。
- 元の `codex/pc-echo-options-lab`、main、TV/GOAL各LABは変更しない。
- 追加オプションを無効にしたPC自由配置（echoOptionsLab=0）と、有効な表示（=1）を同一の安全なプレビューで比較する。

## 原因と実寸

PC共通の `.lab-panel-content {padding-bottom:30px}` が、サイズ変更ボタンを持たないECHOにも適用されていた。先行する反応バー専用の `padding:4px 0` を詳細度で上書きするため、閉じた状態でだけ不要な下余白ができる。既存PC表示と追加オプション表示の両方で同じ原因を再現。

1280×720 / 1920×1080 / 2500×928の全6ケース（追加無効/有効）で同じ実測値：

| 要素 | 修正前 | 修正後 |
|---|---:|---:|
| ECHO全体 | 720×114px | 720×114px |
| 見出し高さ | 48.1875px | 48.1875px |
| 内容領域の高さ | 47.8125px（clientHeight 48） | 同じ |
| メインボタン | 112×40px | 同じ位置・寸法 |
| 内容の上下padding | 4px / 30px | 4px / 4px |
| scrollHeight | 74px | 48px |
| 実際の最大scrollTop | 26px | 0px |

移動や保存復元が原因ではなく、初期配置の時点で発生するCSSの余白競合。オプションを開いた状態には以前から4pxの指定があり、その表示は維持される。

保存元 `codex/pc-lab-goal-log` / `codex/lab-independent-stage1` は別構成で、ECHOに `overflow:hidden;padding:4px 0 0` の専用指定がある。そこへこの30px原因を同一と断定せず、既存ブランチも独立公開LABOも変更していない。今回の「既存」検証は7c461a1に内包する、追加オプションなしのPC自由配置を指す。

## 最小修正

- `pc-lab.css`：`body.pc-default.tv-mode.lab-mode #labReactions>.lab-panel-content` の下paddingだけ4pxにする。overflow:autoを維持する。
- `pc-desktop.js`：修正したpc-lab.cssの読み込み版1.2.5。
- `match.html`：エントリpc-desktop.jsの読み込み版1.2.25。body以降の投稿・保存処理は完全に同一。
- `tests/pc-echo-scrollbar.cjs`：原因再現、通常の実スクロール量0、ボタン実寸、狭幅でのスクロール操作、四隅、保存復元、合体・PULSEリサイズ・分離の回帰検証。

パネル寸法・候補文言・実験データ処理・投稿・時間軸・保存キーは変更しない。ECHOは元から固定サイズ仕様で、単独のリサイズボタンはない。狭幅は手動の420px幅と、合体後のPULSEサイズ変更を検証する。

## 検証

Chrome実ブラウザーで1280×720 / 1920×1080 / 2500×928：

- 既存PC（追加無効）・追加オプションLABの通常表示：不要な実スクロール量0。
- ボタンの文字・位置・112×40pxと、動画/PULSE/ECHO+/REACTの矩形が修正前後で一致。
- 四隅、上下左右移動、オプション開閉・短い候補表示・通常114px高さを維持。
- 420px幅：収まらない通常表示はoverflow:autoのまま、下段のボタンを実際にクリックできる。候補は2段展開し、開いた状態はスクロール不要。
- 合体→PULSE実リサイズ→reload→同じ保存配置復元→分離：全6ケースPASS。設定sentinelと送信者IDを維持。
- 既存 `pc-echo-options.cjs` 全項目PASS：元のナイス追加投稿、閉じる場合の主反応維持、仮候補の実験配列分離、標準PC/TV Silk相当/スマホ相当の矩形不変。
- 実YouTube（1641秒）で再生・停止後、修正前最大scrollTop26→修正後0。元のナイスシュート投稿が端末内で動作。
- 本番Supabase HTTP/WebSocket通信0、未処理例外0。プレビューは空config・SDK撤去・CSP connect-src self、テスト投稿は独立ポートの端末内のみ。

証跡：隣接 `pc-echo-scrollbar-evidence/scrollbar/results.json` と各サイズのbefore/after、`options-regression/results.json`、`real-results.json`、`8077-real-closed.png` / `8078-real-closed.png` / `8078-real-open.png`。Chrome/MacのスクロールバーはOS設定によって自動的に隠れるため、画像に加えてscrollHeightと実最大scrollTopで判定した。

## Mac Chrome URL

- 修正版の追加オプション：`http://127.0.0.1:8078/match.html?id=echo-options-sample&echoOptionsLab=1`
- 修正版の既存PC比較：`http://127.0.0.1:8078/match.html?id=echo-options-sample&echoOptionsLab=0`
- 元の8077は変更しない。8078は独立プレビュー。`/Users/momo/Documents/ChatGPT/PULSE ECHO 開発室/pc-echo-scrollbar-lab` で `python3 serve.py` により再起動可能。

## 未検証

利用者のMac Chrome手動確認は待ち。Safari・実スマホ・Fire TV実機は未検証（対象外モードはChrome UA/viewport回帰のみ）。正式main統合・公開は行わない。
