# オンライン自動復帰・操作制限（2026-09-09）

今回のユーザー指定により、部屋対戦・ランダムマッチの操作期限は60秒、切断猶予は従来の15秒とする。CPU・ローカル対人戦のルールは変更しない。

## 起動とメニュー

- 保存済みonline credentialがある場合、初期HTMLで「対戦に復帰しています…」を表示する。
- `savedHeaders`はcredentialを読むだけ。新規登録や装備更新をせず、active→resume→短期チケット付きWebSocket接続へ進む。
- ページ再起動とforeground復帰で確認する。正常な接続中は再接続しない。
- active確認は1回2.2秒・最大2回、起動マスクは6.5秒で解除。試合なしは通常ホームへ戻る。15秒のサーバー期限を延長しない。
- 従来はオンラインカードがactive確認と、その前段のprofile等を待っていた。現在は選択メニューを同期的に表示し、通信は参加操作以降に行う。
- ランダム待機のキャンセルは選択メニューに戻る。ランダムの部屋中継UI・ルール選択のホームボタンは隠し、部屋対戦側は維持する。

## サーバー時計

- `server/turn-clock.mjs`で操作フェーズと席を解決し、GameRoomの`turnClock`へ絶対期限を保存する。
- 対象はホストのルール選択、準備操作、犬配置、猫潜伏、猫ターン、警察ターン全体。個々の犬移動や捜索、再接続では期限をリセットしない。
- 両者に同じdeadlineとserverTimeを送信。ブラウザではperformance.nowの経過時間で残秒表示する。通信遅延により表示には小さな差が出得るが、勝敗はサーバーだけが確定する。
- alarmと操作受信時に期限を確認し、`finished / turnTimeout`を保存。操作側敗北・相手勝利。準備で両者同時期限切れなら勝者を恣意的に選ばずserverInvalidとする。
- 切断中は15秒判定を優先する。復帰後も元の60秒期限を保持し、既に過ぎていれば時間切れとなる。切断による時間稼ぎはできない。
- randomMatchは既存サーバー検証済み結果・重複排除境界でデイリーへ反映。roomMatchは加算しない。turnTimeoutを切断回数へ加算しない。

## 結果と非同期競合

- 原因は、終了後に到着するconnectionStateが待機表示を開き直すことと、再接続HTTP応答の世代確認不足。
- matchIdの終了済み集合、接続世代、現在socketの照合で旧処理を無効化する。終了通知は同一matchで一度だけ処理する。
- 確定結果で再試行・heartbeat・残秒タイマーと待機表示を解除。切断/時間切れは既存endGameへ渡す。通常勝敗の既存ゲーム演出は維持する。

## ローカル検証コマンド

```sh
node --test tests/*.test.js
server/node_modules/.bin/wrangler dev --config server/wrangler.jsonc --port 8809 --inspector-port 9239 --persist-to server/.wrangler/turn-state
NYAN_LOCAL_API=http://127.0.0.1:8809 node tests/backend-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8809 node tests/reconnection-worker.cjs
NYAN_LOCAL_API=http://127.0.0.1:8809 NYAN_RECONNECT_TEST=yes node tests/browser-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8809 NYAN_TIMEOUT_TEST=yes node tests/browser-online.cjs
git diff --check
```

ChromeテストにはPlaywrightとChromeが必要。複数のランダムマッチ試験を同時に走らせると別試験同士が組になるため、順番に実行する。

本番Worker反映・iPhoneビルド/インストール・実機操作は行わない。ユーザー側ではアプリ終了からの15秒以内復帰、待機側の60秒表示、時間切れ勝敗、切断勝利後のボタン操作、キャンセル再検索、復帰前後のスキン/猫秘密情報を確認する。

## 今回の確認結果

- Node自動テスト：125件成功（既存117件＋操作期限8件）。
- JS/MJS/CJS構文：40ファイル成功。git diff --check成功。
- Wrangler 4.129.0 dry-run成功。GAME_ROOMS/GameRoom・ONLINE_PLAYERS/OnlinePlayersを維持し、設定変更なし。
- backend-online：部屋・ランダム、認証、スキンsnapshot、捕獲、11ターン逃げ切り、不正早期勝利拒否、結果・再検索成功。
- reconnection-worker：5秒/10秒復帰、15秒敗北、snapshot固定、第三者拒否、両者不在の無効終了成功。
- Chrome二者：5秒/10秒復帰、ブラウザ再読み込みからメニュー操作なしで同じ警察ターンへ復帰、猫位置非公開、双方一時切断から復帰成功。
- Chrome切断勝利：結果画面表示、待機表示解除、ホームボタン操作成功。部屋戦デイリー非加算も確認。
- Chrome60秒：実時間で待機し両者のカウントダウン・時間切れ結果・デイリー一度だけ記録を確認。遅延した旧connectionStateで待機表示が再出現せず、結果画面からホームへ戻れる。
- 通信を失敗させた状態でも選択メニュー表示成功。ランダム待機のキャンセル→選択メニュー復帰成功。
- Chromeの320×568、375×667、390×844、430×932、768×1024、844×390のメニュー画面内表示・スクロールなしを確認。JavaScript例外なし。
- スクリーンショットはGit対象外の `artifacts/online-20260906/` 内（timeout-result-0/1.png、disconnect-result-0/1.pngなど）。

## 変更ファイル

- game.js / index.html / style.css：起動復帰、時計、結果優先、オンライン導線。
- online.js / online-identity.js：credential読み取り、自動復帰、古い非同期通知の無効化。
- server/worker.mjs / server/reconnection.mjs / server/turn-clock.mjs（新規）：期限保存・判定・同期。
- service-worker.js：更新キャッシュ名。
- tests/turn-clock.test.js（新規）/ tests/browser-online.cjs / tests/reconnection-worker.cjs：回帰検証。
- GAME_SPEC.md / ONLINE_TURN_TIMEOUT.md（新規）：今回の仕様・確認記録。

未実施：本番デプロイ、GitHubへのcommit/push、iPhoneビルド、インストール、実機操作。
