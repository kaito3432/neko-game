# オンライン基盤（2026-09-06）

## 実装場所と公開順

`server/worker.mjs` は Desktop/nyan-chase-online-main/worker.js を基準とした作業版。
元フォルダと本番Workerは変更していない。既存 `GAME_ROOMS / GameRoom` の名前・6桁部屋コード・通信イベントを維持し、同じCloudflare Workerへ `ONLINE_PLAYERS / OnlinePlayers` を追加する。
Wranglerの既存 `exports` 方式を維持する（[公式仕様](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)）。

公開には先に新Worker、次にWeb/iOSコードを反映する。Worker更新前は既存部屋対戦を旧仕様のdefault見た目で維持し、ランダムマッチは「サーバー更新後に利用できます」と表示する。401や通信失敗を旧サーバー扱いにはしない。
`server/` だけを切り離してコピーしないこと。サーバーは `../engine.js` を参照するため、プロジェクト全体を保ったまま `wrangler --config server/wrangler.jsonc` を使用する。

## 匿名プレイヤーと所持の信頼境界

- 既存localStorageのplayerId・所持・装備・コイン・CPU開放・プロフィールを置換しない。
- 追加キーは `nyanChaseOnlineCredentialV1`。端末で生成した256bit bearer secretを登録前に保存する。同じsecretでの登録再送は同じプロフィールを返す。
- サーバーはsecretのSHA-256を検索キーにし、別の `op_<UUID>` をオンラインIDとして発行。既存IDは `legacyPlayerId` 参照だけで、認証には使わない。
- サーバープロフィールは `version / playerId / legacyPlayerId / createdAt / ownershipSource / ownedCatSkins / ownedDogSkins / equippedAppearance`。
- 初回のみカタログ内のローカル所持を移行する。**これは完全な不正防止ではない。初回申告・資格情報削除による新規登録を信頼できる購入/開放証明とは扱わない。**
- 登録済みsecretで再登録しても所持を追加しない。装備更新APIはserver-owned配列とカテゴリ内の許可IDで検証し、不正・未所持はdefault。
- メール・パスワード・復旧・複数端末同期はない。secretを失うと既存オンラインプロフィールを復旧できない。XSS等によるbearer漏洩対策は本格認証と併せて後工程。

登録後のCPUつよい10勝はローカル解放と同時に `cpuUnlockSync` の未同期状態を保存する。登録済みなら同期を試行し、失敗してもローカル所持は取り消さない。次回オンライン接続時に再送する。送信するのは実績種別だけで、サーバーが `cat_hard_10wins → cat_kaitou`、`police_hard_10wins → dog_detective` を固定決定する。任意skinIdや追加フィールドは拒否し、既所持への再送は書き込みを行わない。

**これはクライアント実績申告による暫定同期であり、DevToolsから実績を偽装できる。CPU勝利をサーバー検証した証拠ではない。** サーバーは付与記録を `unverified-client-claim` として保持する。境界は `cpu-unlock-sync.js` と `server/cpu-unlock-claims.mjs` に分離している。

サーバー応答の実績種別と所持配列を確認した後だけ pending を synced に保存する。確認保存に失敗しても pending を維持する。確認保存はプレイヤーデータの直列キューに予約し、オンライン結果検証から呼ばれても相互待ちしない。旧データで10勝とローカル所持を満たす場合も未同期状態を補完する。remoteProvider使用時の確認保存はprovider管理とし、ローカルから上書きしない。
将来の接続口は `applyVerifiedUnlock(profile, category, skinId, evidence, verify)`。サーバー側検証関数が成功した時だけ追加する内部関数で、公開HTTPからは呼べない。購入/開放の真正な記録は後工程。

## API

| API | 用途 |
| --- | --- |
| POST /api/online/register | secretに紐付く初回移行、以後は既存プロフィール取得 |
| GET /api/online/profile | bearer認証で本人のプロフィール取得 |
| POST /api/online/appearance | 装備希望のみ受け取り、所持検証後に保存 |
| POST /api/online/cpu-unlock | bearer認証、2種類限定の暫定実績申告。本文は achievement のみ |
| POST /api/matchmaking/join | 待機/既存予約取得 |
| POST /api/matchmaking/status | lease更新・成立/最新終了結果の確認 |
| POST /api/matchmaking/cancel | 待機取消、成立が先なら既存マッチを返す |
| POST /api/matchmaking/result | 認証された参加者へ確定結果を返す |

## マッチング

OnlinePlayers内で処理を直列化し、先着の異なるオンラインID同士をペアにする。
待機レコードは `{profile, enteredAt, expiresAt}`。ポーリング2.5秒、待機lease120秒（更新できない放置待機を除外するためで、切断敗北の猶予ではない）。
`queue:<playerId>` はwaitingまたは予約matchIdを保持。同じIDの二重待機・二重ランダムマッチを防止する。

試合は `rm_<UUID>`。`matchType: randomMatch`、host/guestプロフィール、部屋token、役割、日時、状態を保存。
状態はwaiting → matched → playing → finished。waiting取消はcancelled。
役割はサーバーの乱数で片方cat、片方police。履歴による公平化は未実装。
予約を保存してから同じmatchIdのGameRoomを冪等に初期化する。初期化失敗後もstatus再試行で同じ予約を使用する。
キャンセルと成立が競合したらサーバーで先に確定したものを優先する。成立済みを取消済み扱いにしない。
CPUへの自動切替なし。ランク・通常勝利コイン・シーズン・切断敗北/罰則なし。
開始済みランダム試合の接続終了は無効終了として予約を解放する（勝利/デイリー/ペナルティなし）。本格再接続は未実装。

## ゲーム再利用・結果

ランダムは既存オンライン通常戦を開始する。既存の盤面・UI操作・移動・探索・演出・勝敗表示を再利用し、新しいゲーム本体を複製しない。
ランダムに限りサーバーが共有 `engine.js` を読み、影の状態で役割・合法移動・犬の行動回数・11ターン進行・行き止まりを検証する。既存部屋の特殊能力処理はそのまま。
捕獲または検証済み逃げ切り/行き止まりでサーバー結果を固定。結果通知後の再申告は無視する。
GameRoom保存 → ディレクトリ反映（失敗はalarm再送）→ matchFinished通知。広告コールバックには依存しない。
クライアントは通知を既存再送キューへ記録し、認証付き結果APIで役割/勝敗/日時を再取得してからデイリーに反映。matchIdで二重加算を防ぐ。結果画面は別途presentResultで表示する。
部屋対戦はデイリー対象外。randomMatchではCPUスキン開放進捗や通常勝利コインは増やさない。ローカルコイン保存自体をサーバー権威へ移行したわけではない。

## 見た目

部屋参加時/マッチ成立時にサーバープロフィールの検証済み装備を取り込み、役割確定時に
`appearanceSnapshot: {catPlayer:{playerId,catSkinId}, policePlayer:{playerId,dogSkinId}}` を固定し双方に通知する。
本人の所持のみ検証し、閲覧者の所持は要求しない。未知ID・旧クライアントはdefault。
画像URLではなくIDを同期し、既存カタログで駒・下部犬カード・移動/発見エフェクト・結果画像を解決する。
試合中のローカル装備変更やプロフィール更新はsnapshotに反映しない。
警察画面での猫移動エフェクトは盤面全体の位置で表示し、秘密の猫位置を漏らさない。
ホーム・コレクション・CPUバランス・画像素材・エフェクトのサイズや時間は今回変更しない。

## 検証

最終結果：自動テスト99件成功、構文チェック・diffチェック成功。ローカルWorkerの実通信テストとChrome二者対戦テスト、既存デイリー/CPU回帰テストも成功。公開用 `www` / iOS public にクライアント変更を同期済み。

暫定CPU同期テストは両実績について「初回登録済み → CPUつよい10勝 → ローカル解放 → 同期失敗 → 再起動/次回オンライン接続 → 再送 → サーバー所持・装備反映」を確認する。任意ID拒否、再送時の重複書込防止、不正確認応答、確認保存失敗時のpending維持、旧データ補完、自動同期の例外時にローカル解放維持も確認する。

- `node --test tests/*.test.js`
- 全JS/MJS構文チェック・git diff --check
- `tests/backend-online.cjs`: ローカルWrangler 8798。実WebSocketで捕獲・11ターン逃げ切り、早期勝利拒否、部屋対戦・プロフィール・スナップショット。
- `tests/browser-online.cjs`: 隔離Chrome2コンテキスト、ローカルWorker。320×568 / 375×667 / 390×844 / 430×932 / 768×1024 / 844×390。ランダム・部屋を開始から捕獲まで、移動と発見エフェクト、装備固定、randomだけの進捗加算を確認。
- ブラウザテストの状態参照/操作接続口はテスト用HTTPレスポンスだけへ追加。本番game.jsにテスト用所持や勝敗操作を追加しない。
- `tests/browser-daily.cjs`: CPU/コレクション/デイリーと既存ホーム座標の回帰。

本番Cloudflare・iPhone実機・インターネット越しの端末2台ではまだ未検証。公開前に本番Workerとの差分/バインディングを確認し、ステージングまたは承認されたデプロイで検証すること。

## 今回のファイル

既存変更：online.js、game.js、skin-presentation.js、player-data.js、progression-model.js、daily-missions.js、index.html、style.css、service-worker.js、DAILY_MISSIONS.md、関連既存テスト。
新規：online-identity.js、random-match.js、server/worker.mjs、server/online-profile.mjs、server/matchmaking.mjs、server/random-game-validation.mjs、server/engine-environment.mjs、server/wrangler.jsonc、server/package.json、server/.gitignore、tests/online-foundation.test.js、tests/backend-online.cjs、tests/browser-online.cjs、本書。
serverは参照元からの作業コピー。engine.jsは参照するだけで変更していない。以前からの画像変更とコレクション変更は今回の差分として扱わない。
