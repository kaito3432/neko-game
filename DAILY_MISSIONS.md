# デイリーミッション実装（2026-09-06）

## 対象と報酬

現在は正常終了したCPU対戦だけを対象とする。対戦完了1回=10、ネコ勝利3回=20、警察勝利3回=20にゃんコイン。コイン加算は手動受取時だけ。
全達成ボーナスは金額未指定のため未実装。既存の `allClearRewardClaimed` は将来用の枠として維持する。
`local` / `roomMatch` は進捗しない。追加された `randomMatch` は認証付きのサーバー結果を同じコマンド境界へ接続する（詳細は ONLINE_FOUNDATION.md）。

## 保存データ（version 5）

CPUスキン解放と同じ保存に `cpuUnlockSync`（実績別 pending / synced）を含める。通信失敗でも解放を維持し、オンライン接続時に再同期する。暫定的なクライアント申告の制限は `ONLINE_FOUNDATION.md` を参照。

既存の `dailyMissionProgress` を使用する。

```js
dailyMissionProgress: {
  date: "2026-09-06", // 日本時間
  updatedAt: 1788663600000, // 更新日時（ミリ秒）
  missions: [
    {id: "playOneBattle", progress: 0, target: 1, completed: false, claimed: false},
    {id: "winAsCat", progress: 0, target: 3, completed: false, claimed: false},
    {id: "winAsPolice", progress: 0, target: 3, completed: false, claimed: false}
  ],
  allClearRewardClaimed: false
},
skinUnlockProgress: {cat_kaitou: 0, dog_detective: 0},
battleReceipts: [] // 反映済み試合ID。日付変更でも消さない
```

v1〜v3は不足フィールドを補完し、資産・所持・装備・ホーム・プロフィール・統計を保持する。`dailyMissions` 形式も読み取り可能。進捗は目標値で上限を設け、達成フラグは進捗から算出する。

日付更新は起動・復帰・画面を開く時・日本時間0時のタイマー・記録/受取時に確認する。時計を過去に戻しても受取済みの日を再開しない。翌日リセットでもスキン所持と開放進捗は維持する。

## 試合終了と広告の境界

`game.js` の `initGame(false)` で試合識別子とモード・難易度を記録し、`endGame(winner, reason)` の勝敗確定直後に `finishBattle` を呼ぶ。途中離脱では呼ばない。

1. 正常終了した試合を `nyanChasePendingBattles` へ即時記録する。
2. デイリーと開放進捗を更新し、反映済みIDと一緒にプレイヤーデータへ保存する。
3. 保存を確認してから再送待ちの試合を削除する。
4. 結果画面の `showResultAfterCutin` から `presentResult(battleId)` で進捗UIを表示する。

インタースティシャルの実装時も、広告表示・終了・成功のコールバックに1〜3を移動しない。広告後の結果復帰時に4を呼ぶ。広告在庫なし・SDK失敗・広告中の終了でも既に保存した進捗には影響しない。結果表示より保存が遅い場合、保存完了時に表示を更新する。

保存失敗は再送キューから起動・復帰・再接続・デイリーを開く時に再試行する。同じ試合IDの再送はデイリー/開放進捗とも重複しない。端末ストレージ自体が書けない場合は保存成功扱いにせず、画面に保存待ちを表示してメモリから再試行する（ストレージが全面的に利用不能なままアプリを終了した場合の永続化は保証できない）。

## 開放条件

プレイヤーがネコ・CPU難易度の選択値が `hard`・勝利の3条件で `cat_kaitou` を+1。
プレイヤーが警察・`hard`・勝利で `dog_detective` を+1。
各10勝で対応するowned配列へ重複なく追加する。選択難易度を使い、内部のCPU難易度調整関数や勝敗判定は変更しない。

## provider契約

ローカル実装は現在の端末保存用。サーバー導入後にクライアントのコイン/所持/勝敗申告を信用してはいけない。
remoteProvider指定時は以下のコマンドが必要。

```js
recordDailyMissionBattle(playerId, {
  battleId, source, side, difficulty, won, completed: true, completedAt
}) // サーバーで結果検証・重複排除後、battleReceiptsにIDを含む完全なplayerDataを返す

claimDailyReward(playerId, {
  date, missionId, requestId: `daily:${date}:${missionId}`
}) // サーバー時刻・達成を検証し、受取フラグと残高を一トランザクションで更新
```

コマンド未対応/通信失敗時はクライアントで報酬や所持を確定しない。返されたサーバーデータだけを正とする。サーバー側では試合IDと報酬キーを永続的に一意制約で保護する。保存/装備/報酬コマンドはキューで直列化し、Web Locksがあるブラウザではタブ間でも直列化する。

## 未所持画像と演出

指定済みの `*_collection_locked.png` / `*_profile_locked.png` を一覧・詳細・プロフィールへ設定する。読み込みエラーでも未所持の本画像へフォールバックしない。詳細を閉じたら画像srcを外す。CSS黒塗りは廃止し、素材内の「？」をそのまま使用する。
Service Workerは未所持の本画像を一括先読みしない。本画像は所持状態で必要になった時に読み込んでキャッシュする。これはDOM表示の保護であり、公開静的ファイルURLや配信済みJSから素材のダウンロードを禁止する仕組みではない。配信自体の秘匿には将来サーバー側のアクセス制御が必要。

盤面の装飾は通常54px/発見44px、約700ms（100ms表示開始・400ms保持・200ms消去）。同時表示上限6、pointer-events:none。reduced-motion時は移動せず短い静止表示とする。ホームのスキン配置やタップリアクションには変更なし。

## 検証

`node --test tests/*.test.js`、JavaScript構文チェック、`git diff --check`。
`tests/browser-daily.cjs` は隔離Chromeと一時サーバーを使う。CPU開始は実UI、勝敗確定はテスト時だけレスポンスに追加する接続口で再現する。本番コードにはテスト用操作を追加しない。UIのホーム配置はHEAD版と320/375/390/430pxで座標比較する。出力は `artifacts/daily-20260906/`。
