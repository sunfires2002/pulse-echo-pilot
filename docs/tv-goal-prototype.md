# TV GOAL lightweight prototype

Base: 414152f. Branch: codex/tv-goal-prototype. No production release.

## Scope and data contract

Explicit opt-in only: `mode=tv&goalLab=1`. Ordinary TV without the flag, flexible PC, phone and tablet do not load the GOAL module/styles/core. The actual TV/PULSE/REACT/profile/posting files are unchanged; the desktop loader adds the prototype resources conditionally.

`prism-goals-core.js` is a byte-for-byte copy of independent LABO `lab-goals-core.js` at c8fa302. The confirmed contract is documented there in GOAL-FLAGS.md (PRISM exporter ab4240e). `sec`, `kickoff_sec`, `end_sec` are positions in the exported video. No kickoff/cut correction is added. Scorer number remains a string (`07`), OG and optional scorer follow the existing contract. Team and score arrays retain their existing meaning.

Two explicitly fictional fixture records are loaded only in the opt-in prototype, with match_id tv-goal-a / tv-goal-b and youtube_id dSIO3AdVRIs. They cannot match the existing real-named match IDs. Data stays in a normalized in-page store; no GOAL persistence, Supabase access, MATCH LOG UI or editing is added.

- A: separated goals at 1.5, 120.5, 300, 600, 900 and 1638 seconds.
- B: 1.5, 120, 121.2, 122.8, 300, 300.8 and 1638 seconds (nearby comparisons).

## UI and interaction

- Native ⚽: 16px. Hit box: 36×32px. White focus outline. Fits within the existing 48px chart region; no graph/domain/panel height or video resize.
- Uses PULSE_TV_AXIS.secondsToX (the actual Chart.js seconds scale) and canvas CSS scaling. At endpoints the hit box is kept inside the existing PULSE container while the icon retains the exact second coordinate. No independent ratio/axis/padding is introduced.
- Overlapping targets become one ⚽ with the number of eligible nearby goals. Its representative stays at the earliest member's exact time; each member retains its own time in the selection menu. Targets do not overlap.
- A single GOAL seeks to max(0, sec−10) through the existing TV exact-seconds seek/play path. A grouped ball first opens individual choices; selecting one applies the same ten-second lead. The lead is a prototype UI choice, not a transformation of prism data.
- Only goals at/before the current position and within the actual duration are shown, refreshed every200ms. Counts/menu choices also exclude future goals. Clicks revalidate against the current position. After a jump before the goal, that ball disappears until playback reaches it again.
- Nearby selection menu is above the PULSE/toolbar, not a new lane or layout region. Escape closes it without closing an already-open REACT. Outside pointer actions continue normally.

## Verification

`tests/tv-goals.cjs`: Chrome with Silk-equivalent UA at 960×540,1280×720,1920×1080. Compared with 414152f: video, PULSE, chart, toolbar and REACT button geometry unchanged. Verified single/nearby goals, 0/end/outside-duration cases, exact icon alignment, nonoverlapping hit boxes, panel-contained icons/targets, future filtering and stale-choice rejection, 10-second and fractional seeks, normal PULSE and REACT, local posting identity and part changes. Ordinary PULSE expected time is derived from actual click pixels (a pixel is approximately1.9s at960px), preserving its existing rounding.

Existing tv-react-list, tv-profile-settings and tv-toolbar suites pass on all three sizes; ordinary PC/phone/tablet baseline cases pass as well. The pure prism core preserves07, OG and video-position semantics. Captures and JSON: ../tv-goal-evidence/.

Real YouTube validation: tests/tv-goals-youtube.cjs checks A single-goal and B grouped-goal jumps at960×540 and the actual player time. All tests use isolated sample data/config and block production HTTP/WebSocket traffic.

Limitations: Chrome emulation is not physical Fire TV proof; native emoji/white-circle cursor/remote behavior needs hardware review. Balls overlay the existing small reaction plot, so nearby graph strokes can be covered. Only test-data input is supplied; file-import UI, production data integration and a final GOAL design are not included. Main, completed LAB branches and independent LABO remain untouched.

## Fire TV refinement from 1c4106b

The ball changes24→16px and its vertical center uses the chart y=0 position (red reaction baseline), transformed into the existing canvas CSS coordinate system. Horizontal seconds coordinates are unchanged. The36×32px target remains above the tick-label ink; the smaller ball sits toward its lower edge. Count badge moves down2px but remains above and separate from the ball. Nearby grouping and selection-menu behavior are unchanged.

Seek lead changes3→10 seconds, clamped at0; imported sec values and all sample JSON remain unchanged. Labels use the same lead constant. Future hiding and redisplay at the original goal time are preserved.

Three-size tests compare against1c4106b and check16px, x/y alignment, badge clearance, tick-label clearance, preserved hit boxes, future disappearance/reappearance, single/nearby fractional seek and existing TV interactions. Evidence: ../tv-goal-16px-evidence/. Actual YouTube targets110.5 and111.2 seconds were observed at110.557 and111.278 seconds respectively after playback started. Physical Fire TV remains unverified for this adjustment.

## 背景・フォーカス枠の中央合わせ

基点1a75cc2。ボール16pxの絶対座標は変更しない。旧ボタン全体の背景/アウトライン（36×32）を、ボール中心に描画する26×22pxの装飾枠へ分離。フォーカス枠は内側3pxで寸法を変えない。透明なクリック領域は36×32pxを維持して中心をそろえる。件数バッジは枠の上に配置し、数字・ボール・枠が重ならないようにする。

旧背景の中心はボールより8px上。Chart.jsや赤い基準線・ボールの時刻/座標は変更せず、枠とヒット領域だけの配置を修正。26×22pxに分けた理由は、中心を下げても時刻の文字を覆わないため。対象3画面で枠下端から時刻文字の上端まで約2.50px、バッジから枠上端まで1px以上の隙間を確認した。

`tests/tv-goals.cjs` の比較元を1a75cc2へ変更。960×540、1280×720、1920×1080で単独/近接/開始/終端のボール・枠・バッジを測定。単独と近接は変更前後のボールx/y/幅/高さが一致し、全ケースで枠中心とボール中心の誤差0.1px未満。クリック領域36×32、ボール16px、時刻文字やPULSE下端との非重複を検査した。

単独GOAL（120.5秒）のボール中心＝背景/フォーカス枠中心（画面上CSS px）:

| 画面 | ボール中心 | 枠中心 | 中心誤差 |
|---|---|---|---|
| 960×540 | (115.00,509.00) | (115.00,509.00) | 0px |
| 1280×720 | (146.69,689.00) | (146.69,689.00) | 0px |
| 1920×1080 | (210.06,1049.00) | (210.06,1049.00) | 0px |

単独10秒前/先頭下限/終端ジャンプ、未来非表示、近接選択と古い選択の抑止、REACTの開閉と反応ジャンプ、通常PULSEクリック、端末内投稿の名前/送信者ID保持、前後半切替、TVホーム遷移をPASS。動画/PULSE/操作バー/REACTボタンの座標・寸法は基点と一致。実YouTubeでも120.5→110.5秒、近接121.2→111.2秒へのジャンプを確認。本番Supabase HTTP/WebSocketとページ例外は0件。

読込はpc-desktop.js 1.2.20、tv-goals.js/css 0.1.2へ更新。mode=tv&goalLab=1以外には読み込まない。prism-goals/1・GOAL時刻・名前保存・REACT本体・TV本体は変更しない。Fire TV実機の枠の見え方と白丸カーソルの最終判断はユーザー確認待ち。

## D案：近接GOALを直接再生（基点2f254c2）

近接の件数付きボールも、ポップアップを開かず、そのまとまりの最も早いGOALの10秒前へ直接ジャンプする。クリック時も現在位置で対象を再確認し、未来のGOALは件数・ジャンプ対象へ含めない。ポップアップのDOM・イベント・不要CSSは削除。REACTのEscape処理には手を加えない。

既存36pxクリック幅＋6px間隔による近接判定に、先頭から末尾まで最大60秒の条件を追加。secは変更しない。16pxボール、36×32px領域、26×22px枠、赤い時間軸・件数バッジは維持する。読込バージョンはGOAL0.1.3、pc-desktop1.2.21。

Chrome Silk相当UAで960×540／1280×720／1920×1080の2件・3件の直接ジャンプ、未来除外、ジャンプ後の非表示、単独・端・小数秒、通常PULSE、REACT、端末内投稿と名前・ID維持、前後半・TVホームを検証。動画/PULSE/操作バーの寸法は基点と一致。実YouTubeで120.5→110.5秒（実測110.736）、近接120→110秒（実測110.224）を確認。本番Supabase HTTP/WSは0件。

60秒制限の強制検証は7200秒の仮プレーヤーで100/130/160/190/220秒を投入し、[100,130,160]と[190,220]へ分割することを全サイズで確認した。この極端な圧縮条件では、秒位置・36px領域・60秒上限を維持するため、別グループのボールとクリック領域が重なることがある。座標移動や追加選択UIは今回追加していない。通常の約27分のA/Bサンプルではクリック領域の非重複も確認済み。Fire TVリモコン実機は未検証。

画像と結果: ../tv-goal-direct-evidence/。正式main・他のLAB・独立LABO・本番データは変更しない。
