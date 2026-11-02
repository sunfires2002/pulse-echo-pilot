# スマホ・標準モード REACT｜GOAL 軽量LAB

## 基点と範囲

- 最新mainをfetchして `98372f641e85141b239385ca75d08bc08cfb892b` と開始時cleanを確認。
- 専用ブランチ：`codex/mobile-react-goal-tabs`。main・正式公開・既存TV LABは未変更。
- `goalTabsLab=1`の明示指定時だけ実験を有効化。PC標準モードは既存の `mode=review` で確認する。通常PC自由配置を標準モードへ切り替える変更は行わない。
- 利用者回答により、**スマホ横は現状維持、タブの試用は縦だけ**とした。タブレット横（既存の動画優先分岐ではない高さ）は対象。スマホ横には入口やポップアップを追加しない。

## UIと動作

既存REACTカード内へ `REACT｜⚽ GOAL` の2タブを追加。初期はREACT。既存のfilter/timeline要素をそのまま移し、一覧の文言・絞り込み・削除・ジャンプのイベント処理は書き換えない。GOAL側では既存REACTの全員/名前フィルターを流用しない。

スマホは従来の上部REACTボタン、タブレットは従来の表示切替から開く。幅の広い標準PCは従来どおり一覧が表示されるため、そこへタブが付く。動画・PULSE・投稿ボタンの位置/寸法は維持する。

GOALは現在まで・動画時間内のものだけを昇順で表示。個別の行を押すと `max(0, sec−10)` へ小数秒のままシークし再生する。近接GOALも別行で選べる。時刻、チーム、スコア、任意の得点者/背番号/OGを表示。07は文字列のまま保持。時刻見出しは既存表示に合わせ分秒表示、シーク値は元の小数秒を保持する。

250msごとにプレーヤーの準備・動画ID・長さ・現在位置とデータを再確認し、戻りシークや動画切替で未来/旧動画GOALを消す。クリック時にも再検証する。既存行を再利用して、新しい未来GOALの追加時に押下中の行を破棄しない。修正後JSONの時刻順も更新する。

データなしは空の一覧と控えめな案内。動画の長さが取得できる前も誤ったGOALを表示しない。TV/PC自由配置/スマホ横ではUIを作らず、既に作ったUIは取り外して元のREACT DOMへ戻す。標準→PC/TV、スマホ縦→横→縦も確認した。縦へ戻った際はREACTが初期選択。

## prism-goals/1

`prism-goals-core.js`は統合LAB ae7a524 の共通正規化/storeとバイト一致。SHA256:

`6ec1488c2b076f8c74a04d5ad2f060b30d98fb4226942cca92b0bd3d53e7f36e`

`sec`は最終動画0秒基準のまま使用し、kickoff/cut等の補正は行わない。match_id＋half＋youtube_idで照合し、getDurationを超える/現在より未来のGOALを除外する。ハイライトは既存schemaのhalf対応がないため空表示。

入力APIは `PULSE_STANDARD_GOALS.replace(parsedJSON)` / `clear()`。既存storeによる正規化と同じ試合・前後半の丸ごと置換を使用し、ページ内だけで保持。ファイル選択や本番自動取り込み・永続GOAL保存は追加しない。

試作fixtureは `fixtures/react-goal-tabs/react-goal-a.json` とb。Aは単独、Bは120/121.2/122.8秒の近接GOAL等。架空ID react-goal-a/bだけに対応し、実試合へ混ざらない。GOALなし確認用はreact-goal-empty。既存TVやPRISM CUTのコードは変更しない。

## 変更ファイル

- match.html：実験用エントリscriptの追加1か所。既存ロジックは変更なし。
- react-goal-tabs.js/css：モード/向きのガード、タブ、GOAL一覧、シーク。
- prism-goals-core.js：既存正規化/storeの再利用。
- fixtures/react-goal-tabs/*.json：架空GOAL。
- tests/react-goal-tabs.cjs / react-goal-tabs-youtube.cjs：表示・データ・実YouTubeの検証。
- この文書。

profile/home-profile/profile-dialog/style/pc-desktop/pc-base/pc-lab/pc-video-controls/tv-view/config/data/schemaの15ファイルはmainとバイト一致。保存済み配置・送信者ID・本番データは変更しない。

## 最終検証

すべてChrome。iPhone/Android相当はUA/タッチ/画面幅によるエミュレーションであり、実機Safariの検証ではない。

| 画面 | 結果 |
|---|---|
| スマホ320×680、Android相当390×844、iPhone相当390×664 | 既存REACTから開く・初期REACT・タブ切替・GOAL個別ジャンプ・未来除外・動画照合・横スクロールなし PASS |
| Androidタブレット800×1280、1180×820 | 既存切替/レイアウトを維持、GOALタブ・ジャンプ PASS |
| PC標準1440×900（mode=review） | 既存カードを維持して2タブ、同操作 PASS |
| スマホ横844×390、915×412、960×540 | タブ/GOAL core読込なし、追加前と動画/グラフ/ボタンの寸法が一致 PASS |
| PC自由配置1440×900、Silk相当TV1280×720 | タブ/GOAL core読込なし、追加前と寸法一致 PASS |

対応画面では、追加前と後の動画/グラフ/投稿部分/上部切替の座標・寸法を比較して一致。REACTの表示内容と60.5秒への既存ジャンプも維持。GOALの121.2→111.2、120.5→110.5、1.5→0秒、未来→過去→0秒での増減、前後半/動画ID不一致での消去、空データ、キーボード切替を確認した。

390pxではさらにJSON差替え時の時刻順修正・取消、押下中のGOAL追加で既存行を維持して1回でジャンプすることを確認。縦→横→縦で元の横表示とREACT初期選択への復帰も確認した。レイアウトsentinel、名前と送信者IDは維持。

実YouTube（27:21の同じ公開サンプル動画）:

| 画面/GOAL | 命令 | 実測getCurrentTime |
|---|---|---|
| スマホ相当・近接121.2秒 | 111.2秒 | 111.230秒 |
| スマホ相当・単独120.5秒 | 110.5秒 | 110.745秒 |
| PC標準・近接121.2秒 | 111.2秒 | 111.435秒 |
| PC標準・単独120.5秒 | 110.5秒 | 110.733秒 |

各回seekToは1回で、PLAYINGと時刻反映を確認。架空GOALを実動画へ配置したUI検証であり、映像内の実ゴールとの一致を検証したものではない。

本番Supabase HTTP/WS 0件、実投稿0件、未処理例外0件。証跡は `../react-goal-tabs-evidence/final/`、`youtube/`、`unchanged-files.json`。

## スマホ実機URLと起動

`http://192.168.0.16:8075/goal-tabs-test.html`

専用フォルダー：`/Users/momo/Documents/ChatGPT/PULSE ECHO 開発室/mobile-react-goal-tabs-lab`。

Mac起動中・同じWi-Fi。再起動はこのフォルダーで `python3 serve.py`。既存LABのポートは変更しない。名前とサンプル反応は8075だけの端末内保存、本番の保存領域を共有しない。空config、Supabase SDK撤去、connect-src selfで本番通信を禁止。

案内ページでA/単独、B/近接、データなし、PC標準、追加前比較を選べる。名前画面はスキップ可能。2:10付近まで動画を進めてREACTを開き、GOALタブを選ぶ。スマホ横はタブを出さない。PC標準の確認URLにだけmode=reviewを付け、通常PCの初期モードは変えない。

テストは `GOAL_TABS_URL=http://127.0.0.1:8075/ GOAL_TABS_OUT=/absolute/evidence node tests/react-goal-tabs.cjs`。実動画は同環境変数で `tests/react-goal-tabs-youtube.cjs`。

## 未確認・採用判断

LANへのアクセスとChromeでの動作は確認。スマホ物理端末、iPhone Safari、Android実機のタップ/キーボードは未検証。既存の反応送信/削除を本番に対してテストしていない。実PRISM CUT出力は未提供。今回は操作感を見る軽量LABであり、main統合・正式公開は行わない。
