# にゃんチェイスパス：正式仕様と公開条件

にゃんチェイスパスは月額自動更新サブスクリプション。権利の根拠はStoreとサーバーが検証した購読期間であり、クライアントの申告・時計・localStorageではない。価格はStoreの商品情報を優先し、月の日数をアプリ側で30日・31日と計算しない。

## 1. 購読状態

- サーバー所有の `passSubscription` はStore、期間ID、開始・満了時刻、検証時刻、自動更新状態を保持する。期間判定はサーバー時刻で `startsAt <= now < expiresAt`。
- 自動更新をOFFにしても、検証済みの `expiresAt` までは有効。満了後にPass由来の一時権利だけを失う。買い切りSkill、獲得済みSkin、受取済みStamina、Skill Mode永久解放は残る。
- 登録・外観変更などのクライアントpayloadからPass active、期限、所有権を設定できない。

## 2. Skill ModeとPass Skill

- **PassはSkill Modeを解放しない。** Skill Modeは検証済みリワード広告を3回視聴すると永久解放され、Pass満了後も維持される。
- Skill Mode解放済みの本人は、Pass有効中、サーバーcatalogで `passEligible` のSkillを本人のpersonal effective entitlementとして利用できる。現在の対象は `CAT_STEALTH`、`CAT_FAKE_PAW`、`POLICE_HOWL`、`POLICE_GROUP_SEARCH`、`POLICE_DASH`。
- Pass満了時はPass由来の利用権だけを除外する。無料Skillと、単品・Skill Packで永久購入したSkillは既存条件で残る。「利用可能」と「購入済み」は別の状態として扱う。
- 認証済みprofile応答の永久所有データと、画面・選択用の `effectiveSkillEntitlements` を混同しない。対戦後Shop CTAでもRoom共有を永久所有として扱わない。

## 3. オンライン対戦

- **Room Match：両プレイヤーがそれぞれSkill Modeを永久解放済みの場合のみSkill Modeを利用できる。** その条件を満たすと、両者のpersonal effective Skill集合のunionをそのRoom内で一時共有する。借りたSkillは永久ownershipへ書き込まない。
- **Random / Ranked：共有しない。** 各プレイヤー本人のSkill Mode解放とpersonal effective entitlementだけで選択を検証する。
- Match開始時のサーバー側権利snapshotで選択と再接続復元を行う。試合中にPass期限を越えてもそのMatchの選択済みSkillを消さず、次のMatchでは新しい期限で判定する。

## 4. 月替わりPass限定Skin

- 新Skinの対象月は毎月1日に切り替わるJSTの `YYYY-MM` key。サーバー設定 `PASS_SKIN_PERIODS` が月から正式Skin IDを解決し、完成済みcatalogとサーバー所有allowlistの両方にあるSkinだけを付与できる。
- Pass有効者は当月最初の認証済みログインで当月Skinを自動取得する。月途中の加入・更新ではStore検証後に同じ付与helperを通す。月初に未ログインでも、次のログイン時に当月分を判定する。
- 付与・所有・月別受取履歴をサーバーtransactionで保存し、再送や同時実行でも同じ月は1回だけ。過去月への遡及付与はしない。同月の再加入でも二重付与しない。
- 取得済みSkinはPass満了後も永久所有・装備可能。未取得の過去月分と将来月分をCollectionに通常表示しない。
- 第1弾「星灯りの旅ねこ」は `cat_pass_2026_11_starlight`、対象月は `2026-11`。Collection、Profile、盤面駒、Result勝利・敗北、移動・発見Effect、Home character・decorの正式9素材を使用する。Effect倍率は移動 `2`、発見 `1.75`。
- 第2弾「月灯りの旅しば」は `dog_pass_2026_12_moonlit`、対象月は `2026-12`。Collection、Profile、赤・黒・白の丸枠盤面駒、Result勝利・敗北、移動・発見Effect、Home character・decorの正式11素材を使用する。Collection画像はPass紹介にも共用し、通常ショップには出さない。実際の月次付与には別途サーバーの `PASS_SKIN_PERIODS` に `2026-12 → dog_pass_2026_12_moonlit` を設定する必要がある。
- Pass Skinの画像制作では、Collectionは展示台座付き、HomeとResultはそれぞれCollectionとも互いとも異なるポーズにする。犬側のResultは勝利画像に「しば勝利」、敗北画像に「しば敗北」を入れ、両方に「逃げたルートを見てみよう」を入れる。スキン固有の短いセリフは別に添える。

## 5. Collection表示

- 当月の未所有Pass Skinは、認証済みサーバーの当月availabilityがあるときだけ「未所持」として**通常画像**を表示する。所有済みPass Skinは月を越えて「所持済み」として残り、未所有では装備できない。
- Pass Skinに「？」付きlocked画像は使わない。ミッション解放Skinは既存仕様どおり未取得時にも表示でき、専用locked画像を使用できる。両者の表示ルールを混同しない。

## 6. ログインStaminaとGift Box

- 検証済み購読期間ごとに、サーバー/JST日付で異なるログイン日を最大15回数える。連続ログインは不要で、同じ日は1回のみ。1～5回目は各+1、6～10回目は各+2、11～15回目は各+3、合計最大30 Stamina。
- 特典はStaminaを直接加算せず、Gift Boxに発行する。Giftには `rewardId`、`rewardType: STAMINA`、`source: NYAN_CHASE_PASS_LOGIN`、サーバー決定の `amount`、`createdAt`、`expiresAt`、`claimed`、`claimedAt`、期間ID・ログイン回数・日付のmetadataを保持する。
- 未受取Giftの受取期限は発行から**90日**。Pass満了後も期限内なら受取できる。受取はrewardId単位で原子的・一度だけ行い、受取済みStaminaに期限はない。
- Gift受取時は通常の自然回復上限5を超えて保持できる（例：5+3=8）。自然回復・広告・Coin回復の既存条件は変更しない。未受取・期限内の件数をHomeとGift Boxに表示する。

## 7. Pass画面と価格

- 当月SkinのHero、対象Skill、Skill Modeの広告3回条件、ログイン進捗、Gift Box、購読状態を表示する。状態は認証済みサーバーの `passSummary` に基づき、画面だけで権利や報酬を作らない。
- active、自動更新OFFでも期限内、expiredを区別する。取得済みSkinと期限内GiftがPass終了後も残ることを案内する。
- Store未接続時の「月額500円予定」は一箇所の**表示用placeholder**で、購入を許可しない。商品取得後はStoreのlocalized priceを優先し、価格を複数箇所へ固定記述しない。

## 8. iOS StoreKit 2（Phase 6）

- **コード実装済み／Sandbox実購読QA保留。** Apple Developer Program加入後にSubscription Group、Product ID、App Store Connect商品、Server API secretsを整え、Sandboxで購入・復元・更新・自動更新OFF・満了・再加入を確認する。
- 購入成功や端末側のverified transactionだけでPassをactiveにしない。ServerがApple App Store Server APIの認証済み応答でProduct、Bundle、Environment、Subscription Group、player binding、transaction replay、古い期間へのrollbackを検証してから期間を書き込む。
- 現在はApple APIの**認証済み応答を信頼境界**とする。返却JWSについてApple証明書チェーンをアプリ独自で完全にローカル検証する実装ではない。
- 購入、復元、起動後のentitlement同期、画面表示時の再確認を通じてServerへ照会する。App Store Server Notifications V2の受信endpointは現時点でなく、pull同期をfallbackとする。Store IDやsecretが欠ける場合、購入CTAは無効にする。

## 9. Android（後続Phase）

Google Play BillingによるPass Subscriptionは未実装（Phase 7相当）。将来はGoogle Play server verification後の期間を同じサーバーモデルに接続する。iOSのtransactionやApp Store IDをAndroid権利として流用しない。

## 10. 公開・deploy前の要件

- Productionで2026-11のSkinを付与するには、正式な `PASS_SKIN_PERIODS` mapping（`2026-11 → cat_pass_2026_11_starlight`）が必要。**現在のProduction設定にはこのmappingがない。** 設定とWorker反映は別工程であり、この仕様書だけでは付与されない。
- Store商品・Subscription Group・Apple Server API secretの正式設定とSandbox実購読QA、Production rollout確認が別途必要。Sandbox専用の先行表示、mock購読、早期付与、player allowlistは本書の正式仕様に含めない。
