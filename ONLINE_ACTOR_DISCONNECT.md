# 操作担当別の切断処理

従来はserver/worker.mjsがdisconnectsの有無だけで全gameメッセージを拒否し、online.jsも同条件でpausedにしていた。時計は絶対期限のまま進むため、待機側の切断で操作可能時間が削られていた。

## サーバー境界

- turn-clock.mjsのactorStateが検証済みstate.phase → cat/police → seat → profile.playerIdを解決。dogSetup/dogsは警察、catSetup/catは猫。host/guest固定ではない。
- connectionState/recoveryにcurrentActorPlayerId/currentActorSeat/currentPhase/actorDisconnectedを送る。切断記録はplayerId/at/deadline。クライアント申告の操作担当・期限を信用しない。
- 待機側切断時は接続中の合法操作を継続。本人が切断中か操作担当不在ならgameメッセージを拒否する。ルール検証と秘密情報のallowlistは維持。
- Room / Rank（randomMatch）共通で、操作担当の接続状態に関係なくターンの絶対deadlineを維持する。復帰時も期限は延長せず、deadlineとサーバー時刻の差で残秒を表示する。
- 次phaseが不在者担当でも開始時点から60秒を進める。disconnectsのdeadlineは元の15秒を使い、同じ切断の重複通知では延長しない。復帰成功後の新しい切断は既存どおり新しい15秒猶予だが、同一ターンの期限は動かない。
- ターン期限と切断猶予のうち先に到来した終了条件を適用する。同時なら切断判定を維持。preGame中止は既存仕様のまま。

## クライアント

サーバーのactorDisconnectedと本人切断を用いてpausedを決定。待機側のみ不在ならpointer-events:noneの小さな通知のみ。通常操作・選択状態は変更しない。本人が復帰した接続だけにrecoveryを送り、既存の秘密情報除外済みサーバー状態を復元する。接続が継続していた相手へrecoveryで盤面を上書きしない。

## 検証

node --test tests/*.test.js。ローカルWorker8811でNYAN_ACTOR_TEST=yesを付けたtests/browser-online.cjsを実行。初期配置・猫潜伏・待機側反復切断・合法移動・選択維持・本人10秒切断・最新状態復元・秘密情報・15秒切断結果を確認する。既存backend-online/pregame-worker/reconnection-worker/Chrome回帰も確認する。

本番デプロイ・GitHub保存・iPhoneビルド・実機操作は今回対象外。

最終結果：自動テスト144件成功、構文チェック46ファイル成功、git diff --checkとWrangler dry-run成功。ローカルbackend-online/pregame-worker/reconnection-worker、Chrome新規actor試験（通常猫移動を含む）・既存再接続・60秒タイムアウト試験成功。JavaScript例外なし。CPUロジック・engine・プレイヤーデータ保存仕様・所持品・コイン・本番設定は変更していない。
