# 開始前中止と試合別スキン（2026-09-09）

## 原因と修正

通常のランダム参加UIはprepareIdentityを呼んでいた。ただし、従来のマッチ成立応答には本人のプロフィールがなく、クライアントのverifiedProfile/sessionProfileキャッシュとsnapshotを照合していた。キャッシュが不足するとsnapshot全体を受け入れられず相手も標準表示になる。古いdefault装備キャッシュと照合すると、正しいdog_detectiveも自分側だけdefaultへ落ちる。これらの経路をtransportテストで再現し修正した。実機内のデータを読み取ったわけではなく、報告された症状すべての実機原因を断定するものではない。

- ランダム成立応答とrole通知に、その試合のサーバープロフィールを含める。認証済み本人の席・playerId・役割・所持・装備を照合する。
- 他人のスキンを表示する際、閲覧者のローカルownedを参照しない。相手のplayerIdに紐付くsnapshotから駒・カード・エフェクト・結果画像を解決する。
- snapshot未取得はpendingのまま保持し、受信後に再描画する。不正IDはカタログのdefaultへフォールバックする。
- 入室時に前試合のsnapshot、役割、部屋情報を初期化し、既存appearance変更通知で選択犬・エフェクトをクリアする。旧socket/旧matchのrole通知も拒否する。
- 探偵しばのカタログ画像はassets/www/iOS publicで内容一致を確認。画像ファイルの変更は不要だった。

## サーバーの開始境界

`server/match-lifecycle.mjs`が、ルール確定・双方ready・双方WebSocket接続・切断なしを確認し、engine初期状態を作る。特殊ルールでは双方の能力決定も必須。

この時点でhasStarted=true、matchStartedAt、status=playing、publicPhase=dogSetupを保存する。柴犬の初期配置から勝負開始後となる。旧保存にはstarted/readyの補完を使うが、明示的なhasStarted=falseを上書きしない。

開始前は時計を作らず、旧rule/ready時計も適用しない。切断検知でcancelled / abortedBeforeStartを保存・通知する。勝者・敗者・デイリー結果を作らず、切断履歴にも加算しない。接続予約後にWebSocketが一度も開かない参加者も15秒後に接続失敗として中止する。この待ちは勝敗猶予ではなく、UIに残秒を表示しない。

開始後は15秒切断猶予と各操作フェーズ60秒を維持する。再接続で期限をリセットせず、試合のスキンも固定する。結果APIは開始前の試合を報酬結果として返さない。切断履歴はhasStarted=trueかつdisconnectForfeitのみ。

## UI

成立前はキャンセル可能。成立後はオンライン待機画面・ルール選択・能力選択の戻る/ホーム導線を隠す。ルール・接続・準備中は残秒なし。playingのみ双方に時計を表示する。

開始前中止は「対戦相手との接続が終了しました。勝敗は記録されません。」を表示し、待機・ルール・能力のoverlayを解除する。「オンライン対戦選択へ」から再検索できる。再起動時に取得した開始前中止も同じ扱い。

## 検証方法

ローカルWorkerは8810番を使用。以下のChrome試験はランダムキューの混在を避けて順番に実行する。

```sh
node --test tests/*.test.js
NYAN_LOCAL_API=http://127.0.0.1:8810 node tests/backend-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 node tests/pregame-worker.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 node tests/reconnection-worker.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 NYAN_PREGAME_TEST=yes node tests/browser-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 NYAN_OPPONENT_TEST=yes node tests/browser-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 NYAN_RECONNECT_TEST=yes node tests/browser-online.cjs
NYAN_LOCAL_API=http://127.0.0.1:8810 NYAN_TIMEOUT_TEST=yes node tests/browser-online.cjs
```

ChromeテストにはPlaywrightとChromeが必要。実機操作・本番反映・アプリビルド・GitHub pushは今回行わない。iOS公開ディレクトリの画像は検査済みだが、今回変更したJSをアプリに含める作業は次回ビルド時に行う。

## ローカル最終確認結果

- 自動テスト137件すべて成功。JS/MJS/CJS 45ファイルの構文チェック、git diff --check、Wrangler 4.129.0 dry-run成功。
- backend-online、開始前中止6ケース（部屋/ランダム、host/guest/接続途中）、再接続Worker試験成功。5秒/10秒復帰、15秒切断敗北、双方不在の無効終了、履歴、デイリー重複防止を確認。
- Chrome二者の開始前65秒待機で時計・勝敗なし、中止後双方が選択画面へ戻れることを確認。
- Chrome二者の部屋/ランダムで役割交換、非対称所持、閲覧者未所持でも相手スキン表示、柴犬3駒・カード・結果画像、同一クライアントの次試合defaultを確認。
- Chrome再接続試験で5秒/10秒復帰、再読み込み復帰、猫位置秘匿、スキン固定、移動/発見エフェクト、結果画面操作、JavaScript例外なしを確認。
- Chrome実時間60秒試験で双方の残秒、turnTimeout結果、デイリー1回のみ、遅延通知による通信overlay再表示なしを確認。
- 本番Worker・GitHub・App.app・iPhone実機には反映していない。
