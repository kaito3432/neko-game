# 切断・再接続基盤（2026-09-07）

## 再現可能なローカル実行環境

プロジェクトルートで実行する。Wranglerはserver/package.jsonとpackage-lock.jsonに固定し、一時ディレクトリのインストールを使用しない。

```sh
npm ci --prefix server
server/node_modules/.bin/wrangler --version
server/node_modules/.bin/wrangler deploy --config server/wrangler.jsonc --dry-run
server/node_modules/.bin/wrangler dev --config server/wrangler.jsonc --port 8808 --persist-to server/.wrangler/state
```

別ターミナルで `NYAN_LOCAL_API=http://127.0.0.1:8808 node tests/backend-online.cjs` と `node tests/reconnection-worker.cjs` を実行する。node_modulesと.wrangler/stateはGit対象外。

今回のユーザー指定により猶予は15秒。GAME_SPECの将来目安60秒より今回の指定を優先する。ランク、通常勝利コイン、利用制限は追加しない。本番へのデプロイ、iPhoneビルド・インストール・操作は行わない。

## 境界

- GameRoomがcloseとheartbeat(lastSeen)で切断を検知する。heartbeatは2.5秒、サーバー側で9秒間未受信なら切断検知。15秒は検知時刻から計算する。
- `server/reconnection.mjs`が期限と同時切断を判定する。クライアントの時計や残秒値は判定に使わない。片方が不在ならその期限でdisconnectForfeit、双方不在なら両期限まで待ちserverInvalid。
- Durable Object alarmで期限を評価し、結果を保存してからOnlinePlayersへ送る。失敗時はalarmで再送し、履歴はmatchIdで重複排除する。
- 復帰用POSTは既存bearerで本人を認証する。本人の席に限る短期チケットで同じ部屋のWSを張り直す。socket generationにより旧接続のmessage/closeを排除する。
- 移動等は切断中にサーバーで拒否。クライアントは待機オーバーレイで操作を止める。通常の配置・移動確定には共有engineのサーバー状態を使う。

## 復元・秘密情報

- 役割別allowlistのsnapshotから現在ターン、フェーズ、犬位置・行動済み、選択犬、公開足跡、ルールと固定装備を復元する。
- 猫の位置、履歴、忍び足・フェイクの内部記録は猫本人だけに返す。警察snapshotにはキー自体を含めない。
- 初期配置途中の犬位置はサーバーへ保管するが相手へ中継しない。スキル選択確定前の未確定操作は復元しない。確定済みの非公開スキルは本人だけに返す。
- OnlinePlayersのactive情報から、オンライン画面を開いた時に復帰先を取得する。起動時のホーム画面は変更しない。
- 期限後はサーバー結果を取得する。通信自体が回復しない場合、勝敗をクライアントで推測せず結果確認待ちにする。

## 結果・履歴

- disconnectForfeitはrandomMatchのみ既存の認証付き結果receiptからデイリーへ接続する。roomMatchは加算しない。コインは追加しない。
- `disconnectStats:<onlinePlayerId>`に`totalDisconnectForfeits`と`recentDisconnects`（直近100件）を保存する。`forfeit:<matchId>`で再送を重複排除する。勝者・復帰成功・無効終了は記録しない。
- サーバー処理例外と長時間alarm停止は保守的にserverInvalidとする。全ての通信障害の責任を完全に特定できるわけではない。両者不在は一方を敗者にしない。

## 追加の3修正

- 警察側の猫移動エフェクトを削除。公開痕跡発見時の猫スキン演出は維持。
- 開始前の明示的キャンセルで予約を終了でき、次のjoinはキャンセル要求の完了を待つ。通信断は明示キャンセルと別で15秒猶予。
- ランダム成立直後の内部rm_UUIDコードは表示せず接続状況を表示。通常部屋の6桁コードは維持。

## 実機確認（ユーザー担当）

1. 両側を更新後、新しい部屋／ランダム対戦で確認する。
2. Wi-Fi切替やアプリ切替で5〜10秒以内に戻り、同じ試合・スキン・手番で続く。
3. 15秒超過で不在側敗北、残った側勝利。双方戻らない場合は無効。
4. 再起動後オンライン入口から復帰／結果表示できる。
5. 配置中・スキル選択中・犬選択中でも復元し、警察に猫位置が漏れない。
6. ランダム切断結果だけデイリーが一度加算される。
7. 明示キャンセル後に再検索でき、長い内部コードが表示されない。

## 変更ファイル

- クライアント：game.js、online.js、random-match.js、style.css、service-worker.js（wwwへ同期）。
- サーバー：server/worker.mjs、server/reconnection.mjs（新規）、server/matchmaking.mjs、server/session-events.mjs、server/online-profile.mjs。
- テスト：tests/reconnection.test.js、tests/reconnection-worker.cjs（新規）、tests/online-foundation.test.js、tests/backend-online.cjs、tests/browser-online.cjs。
- 文書：ONLINE_RECONNECTION.md（本書）。既存binding・namespace設定は無変更。

## 最終確認結果

- Node：117件成功。5秒/10秒/14秒復帰、15秒期限、双方復帰・片方のみ復帰・双方不在、秘密情報allowlist、無効結果の勝敗なしを含む。
- ソースJS/MJS/CJS：38ファイル構文チェック成功。git diff --check成功。
- ローカルWorker：既存部屋・ランダムの捕獲/11ターン終了回帰成功。
- 実WebSocket：5秒/10秒復帰、15秒切断敗北、履歴、第三者復帰拒否、双方不在無効、ランダム切断勝利receiptのデイリー一度だけ加算成功。
- Chrome二者：5秒/10秒自動復帰、双方切断復帰、警察ページ再読み込みで秘密位置なし、同一snapshot、復帰後対戦続行、15秒超過/再読み込み後の結果表示、部屋デイリー非加算成功。JS例外なし。
- コード更新中のWorkerホットリロードで試験が中断したため、更新を止めて再実行し成功を確認した。
- 実機試験、本番デプロイ、iPhone再ビルド・インストールは未実施。

注意：特殊スキル全組み合わせの切断タイミングをChromeで網羅したわけではない。サーバー障害の完全な原因帰属も不可能なため、検出できた内部例外・長いalarm停止・双方不在・復帰認証サービス障害は無効側に扱う。サーバーそのものが応答不能の間はクライアントで勝敗を作らず、オンライン入口から結果を再取得する。
