# TV Ver.1.0 最終統合LAB（未公開）

## 基点と統合方針

- branch: `codex/tv-v1-integration`
- 最新remote main確認: `98372f641e85141b239385ca75d08bc08cfb892b`。開始時のmainはclean。
- TV/REACT/GOALの選択元: `206df8c4f24f4a6a889bea12d8f7069520f1fd1c`。
- 最新mainから新規worktree/branchを作り、TVファイルだけを選択移植した。旧LABの全体マージ・mainへの統合・公開は行わない。Gitのマージ競合は発生していない。
- `index.html`/`match.html`はmainの共通名前設定を維持し、読込バージョンのみ更新。旧`tv-profile-settings.js/css`は持ち込まない。
- `profile.js`・`home-profile.js`・`profile-dialog.css`はmainとバイト一致。名前キー・送信者ID・ゲスト生成・IMEガードを維持する。
- `profile-dialog.js`へ旧TV LABのフォーカス制御の必要部分だけ統合。URL mode=tvでのみ、開いているダイアログ外のフォーカスを戻し、初回ゲート終了後はホームへ復帰する。初期はスキップ。既存Tabトラップは1つだけ、別の名前画面や保存処理を生成しない。
- `pc-desktop.js`と`tv-view.js/css`は操作バー・REACT・共通TVシークの選択移植。match.htmlのloaderは1.2.22、profile-dialog.jsは1.0.1へ更新。

## 保持した仕様

ホーム96×40 → 反応5種類 → REACT96×40。REACT75%背景・18px共通アイコン・追従・前後シーク更新・個別反応ジャンプを維持。

GOALは16px、クリック36×32、装飾枠26×22、赤い秒軸中心、未来非表示、近接件数、D案の先頭GOAL−10秒（0以下にしない）。最初と最後の差は最大60秒。GOAL/REACT本体とprism coreは206df8cとバイト一致。

自由配置・合体分離・保存・PC動画操作・スマホ/タブレットUI・投稿形式は変更していない。mainと同一の保護ファイルを `../tv-v1-evidence/protected-files.json` に記録。

## prism-goals/1 の時刻と差替え

PRISM CUTの既存logger.html `peData()` を読取確認。出力sec/kickoff_sec/end_secは最終動画先頭を0とした値で、PULSE ECHOはkickoffやカット開始位置を再度引かない。PRISM CUT側は変更していない。

正規化済みstoreはmatch_id＋halfで丸ごとreplaceし、表示はmatch_id/half/youtube_idを照合、duration取得前・動画範囲外・未来は表示しない。07は文字列、得点者なし/OGを維持。不正データの除外は既存仕様どおり。

テストでは600.5秒のGOALを700.2秒・別チーム・別スコア・OGへ置き換えて旧ボールが消えること、空goalsによる取消、別試合/前後半/YouTube ID不一致の非表示、時間外除外を確認。kickoff_sec=100でも600.5→590.5秒へジャンプし、二重補正しない。

**実PRISM CUT出力JSONは未提供**。このチャットの既知の検証フォルダーとローカルprism-cut/prism-cut-nextを確認したが実出力は見つからない。検証に使用した連続GOALは架空サンプル。実動画へのジャンプは検証したが、映像内の実際のゴールとの一致を確認したものではない。

既存の`mode=tv&goalLab=1`と架空試合ID限定のfixture読込、`PULSE_TV_GOALS.replace(parsedJSON)` APIを維持。新しいファイル選択UI・本番自動取り込み・永続GOAL保存は追加しない。実試合に表示するには、正しいIDの実JSONをこのAPIへ与えて再検証する必要がある。

## 自動・実ブラウザー検証

すべてChrome（Silk/iPhone/Android/iPadはUA/viewport/touchエミュレーション）。実Fire TV・iPhone Safari・タブレット実機の証明ではない。

| 検証 | 結果と対象 |
|---|---|
| tests/tv-goals.cjs | 960×540 / 1280×720 / 1920×1080：16px/36×32/26×22、中心/秒軸誤差0.1px未満、未来、D案2/3件、60秒上限、差替え/取消/ID照合、通常PULSE/REACT、端末内投稿、前後半/ホーム PASS |
| tests/tv-v1-profile.cjs | TV3サイズ：直接リンク初回ゲート、skip初期フォーカス、Tab/フォーカス制御、入力・スキップ・名前変更・キャンセル・空欄エラー・試合A→ホーム→B・ID保持・再読込 PASS |
| tests/common-profile.cjs | PC/Android/iPhone相当/320px/スマホ横/タブレット/Silk：共通名前設定、IME中Enter防止、短いviewport、ゲストと送信者ID、モック投稿 PASS |
| tests/tv-toolbar.cjs | TV3サイズ＋PCのTV：横1列、端96×40、左右12px、PULSE下端、5種類の端末内投稿、ホーム往復 PASS。通常PC/スマホ/タブレットは98372f6と比較PASS |
| tests/tv-react-list.cjs / tv-react-appearance.cjs | TV3サイズ：開閉、未来反応の非表示、追従/戻りシーク、文字/音声テキスト、75%背景、18px見出しアイコン、白枠、長文スクロール、寸法維持 PASS |
| tests/tv-integration-scope.cjs | 1280/1920/2500のPC、iPhone/Android縦横、Androidタブレット、iPad縦横の計10ケースを98372f6と比較。通常ホーム・視聴の表示/座標・アイコン/名前・保存sentinel一致 PASS |
| tests/tv-seconds-axis.cjs | 1205/1800/2705秒、duration未準備、クリック/再生線/反応位置/動画切替 PASS |
| tests/tv-goals-youtube.cjs | 実YouTube：単独120.5→110.5秒（実測110.553）、近接120→110秒（実測110.203）PASS |
| tests/tv-react-youtube.cjs | 実YouTubeのコメント60.5秒ジャンプ、実測60.710秒、未来300秒の非表示 PASS |
| tests/pc-video-controls.cjs (PC_VIDEO_ONE=1) | 実YouTube/1280：PCクリック・つまみシーク、再生停止、音量/ミュート、全画面/Esc、動画だけ、PC⇔TVで時間・音量・状態保持、合体→reload→復元→分離 PASS |
| tests/tv-v1-live.cjs | LAN実機用環境/実YouTube/TV3サイズ：単独＋近接D案、REACT105秒ジャンプと未来除外、共通ホーム名前変更、別試合移動、送信者ID保持、各寸法/中心、ポップアップなし PASS |

本番SupabaseのHTTP/WebSocket通信0、実投稿0。config/schemaを変更していない。共通プロフィールの投稿テストは完全に差し替えたモック、TV投稿は空backendの端末内保存。LAN環境もconfig={}、SDK撤去、CSP connect-src selfの三重対策。正式サイトや他ポートのlocalStorageに触れない。

初回の一部並行実行で準備待ちtimeoutを記録した。検証サーバーの接続待ち数を128へ拡大し、実YouTube用の待機条件へAPIメソッド存在確認と失敗時診断を追加した後、最終実行はPASS。旧TVテストの比較元/名前欄期待値は公開済みmainに合わせて修正した。待機timeoutの根本原因をアプリ不具合/環境障害のどちらとも断定していない。アプリのプレーヤー生成・retry処理は変更していない。

## Fire TV実機URL

- 統合LAB：`http://192.168.0.16:8067/?mode=tv&goalLab=1`
- 案内：`http://192.168.0.16:8067/goal-test.html`
- 初回を試す：8067でまだ名前を保存していない状態で `match.html?id=tv-goal-a&mode=tv&goalLab=1` を直接開く。既に保存した場合は初回状態に戻すために既存データを消さず、別の独立オリジンを用意する。
- Mac起動中・同じWi-Fi。既存8065/他LABはそのまま。8067専用のlocalStorageで名前・端末内反応を保持。GOALはページ内だけ。
- Aは単独、Bは近接。2:10付近までPULSEを押すとBの3件が出て、押すと1:50へ直接戻る。

## 残る条件と公開判断

1. 統合版のFire TV Silk実機でカーソル/リモコン、ソフトキーボード/戻るキー、名前設定、長文一覧、下端を最終確認する。
2. 実PRISM CUT出力JSONとその対応動画で、取消/修正後データ・動画0秒基準・実ゴール映像へのジャンプを確認する。サンプル成功を実データ成功と扱わない。
3. 206df8c由来の既知制約：2時間など極端に長い動画へGOALを密集させると、60秒で分割したグループ同士の36px領域が重なる場合がある。約27分のA/Bでは非重複を検証済み。デザイン/座標は変えていない。
4. Safari/WebKitランタイムはローカル未導入。iPhone Safari/Android/Fire TV実機の今回統合版は未検証。前回のMac Safariプロフィール実機結果は今回の統合実機検証に代用しない。

統合LABの自動検証は完了。**正式公開の最終GOはまだ出さず、実機・実GOAL入力条件の確認とユーザー判断を待つ**。main・正式Pages・既存完成LAB・独立LABO・PRISM CUT・本番Supabaseは変更しない。
