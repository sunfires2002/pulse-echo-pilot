# PULSE ECHO 情報保護状態表

記録日: 2026-11-06
基準GitHub main: `db2004f8ccad8b1728dc3429b3394a7488d1271f`
LAB: `codex/tv-goal-db2004-lab`（基底 `0f75be65d71d516f8824d67d896b3353ad1a670b`）
状態の扱い: 「未確認」は空欄や推測で補わない。利用者報告は独立確認と区別する。

| 対策 | LAB | main | 本番DB | 実機 | 確認日 | 証拠 |
| -- | -- | -- | -- | -- | -- | -- |
| 公開試合RPC・許可項目 | db2004の実装を保持。今回のTV差分はRPC読取コードに触れない。 | GitHub main `db2004f8` は `public-matches.js` 経由で `pulse_public_matches_v1` を使用。 | **未確認**。2026-11-05 12:47の利用者報告はHTTP 200・17件・12項目。今回のDB再照会は未実施。 | 12:47の利用者報告ではPC・スマホ・テレビ相当で画面表示を確認。新LABの実機結果ではない。 | 2026-11-05（GitHub/Pages）。DB・端末は報告時刻のみ。 | [GitHub main](https://github.com/sunfires2002/pulse-echo-pilot/commit/db2004f8ccad8b1728dc3429b3394a7488d1271f)、[Pages run](https://github.com/sunfires2002/pulse-echo-pilot/actions/runs/41957410162)、利用者報告 12:47 |
| 匿名の原本SELECT | TV LABはDB権限を変更しない。 | 公開画面コードはRPCを使う。一方、`supabase-schema.sql` には匿名権限を広く許可する既存ポリシーが残る。ソース上のSQLと本番状態を同一視しない。 | **未確認**。12:47の利用者報告は原本SELECTが401。今回の `00-preflight.sql` 実行なし。 | 対象外 | 2026-11-05（ソース）。DBは報告時刻のみ。 | `supabase-schema.sql`、12:47利用者報告、`codex/public-information-protection-lab` の読み取り専用preflight案 |
| RLS・管理者認証 | 今回は変更なし。 | RPC導入後も `admin.html` は現状の直接接続方式。管理者認証・本番管理RLSの統合を示すmainコードは未確認。 | **未確認**。管理者認証LABの検証結果は専用テストプロジェクトのもの。 | 対象外 | 2026-11-05 | `admin.html`、`supabase-schema.sql`、`codex/admin-safety-lab` のテスト記録 |
| バックアップ削除・再混入検査 | db2004の保護ファイルと検査を保持。リリース範囲チェックで差分を監視。 | c34608eで公開ルートのバックアップを削除。mainに再混入検査とCIがある。 | 対象外。Git履歴上の過去ファイル消去は別確認。 | 対象外 | 2026-11-05 | `tools/check-public-backups.cjs`、`.github/workflows/public-backup-check.yml`、`BACKUP-REMOVAL.md` |
| TV操作・REACT一覧 | `0f75be65`から保持。Fire TV実機で8項目確認済みとのユーザー報告は前LABの記録。 | db2004にはこのTVレイアウト差分なし。mainへ反映していない。 | 変更なし | 前LABの操作8項目は確認済みとのユーザー報告。本LAB上での再確認ではない。 | ユーザー報告: 2026-11-05。端末ログ・機種・Silk版: 未確認。 | 前LABの [情報保護状態表](../tv-layout-lab-db2004/INFORMATION-PROTECTION-STATUS.md) |
| TV GOAL（16px・D案・10秒前・未来非表示・クリック保持） | 選択移植済み。`goalLab=1`のみ。現LABの`PULSE_TV_AXIS`を使用。合成fixtureのブラウザー試験PASS（Silk相当UA）。 | 未搭載。 | 変更なし。合成fixtureのみ。 | **ユーザー報告で実機OK:** 単独GOAL、近接GOALのD案、GOAL・REACT操作。個別項目すべての再確認とは扱わない。 | ブラウザー: 2026-11-06。実機報告: 2026-11-06。機種・Silk版・詳細記録: 未確認。 | ユーザーの11月6日進捗報告。確認手順と報告範囲は [Fire TV手順](FIRE-TV-RECHECK.md) |
| ブラウザー回帰（PC・スマホ・TV相当） | 合成データで検証済み。PC/タブレット/スマホ標準3サイズ、Silk相当TVサイズを含む。 | 対象外（LAB差分）。 | 接続なし。 | ブラウザー試験済み。Fire TV実機確認とは区別。 | 2026-11-06 | `tests/tv-layout-regression.cjs`、`tests/tv-react-list.cjs`、`tests/tv-react-load-failure.cjs`、`tests/tv-seconds-axis.cjs`、`tests/tv-goals.cjs`、`tests/tv-goal-click-fix.cjs`、`tests/tv-goal-gate.cjs` |

## 参照先の混同防止

- このLABの基準はGitHub APIで確認した `main=db2004f8`。
- 旧ローカル作業場の `main` / `origin/main` は `c34608e`。その `origin` は別のローカル作業コピーを指しており、GitHubの最新状態を示さない。
- `origin/main` の名前だけで基準を判断せず、GitHubの `sunfires2002/pulse-echo-pilot` の `main` SHAを記録してから作業する。
- 本番DBと端末状態は、ソースやCIから推測せず、確認日時・方法・報告者を証拠欄に記録する。
