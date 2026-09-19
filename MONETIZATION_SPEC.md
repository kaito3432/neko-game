# Monetization Phase 1

## Scope

Phase 1 provides only the shared state, product catalog, mock APIs, and a development-only UI.
It does not connect an advertising SDK or perform a real store transaction.

## Ownership boundary

- `monetization-products.js` defines stable product IDs without prices.
- `monetization.js` owns cached monetization state and the SDK/provider boundary.
- `monetization-ui.js` is available only with `?monetizationDev=1`.
- Game rules, coins, skins, online state, and rewards do not import SDK-specific code.

The Phase 1 localStorage value is a development cache and is not proof of purchase. A future
native store provider must verify transactions/entitlements and return the complete verified
`purchasedProductIds` list from `restorePurchases()`. That verified list replaces the cached list.
Server-owned items and online entitlements must be granted only after server-side receipt or
transaction verification; the JavaScript mock result must never be treated as purchase proof.

## Phase 2 connections

Phase 2 adds persisted skill-mode progress and skill entitlements. The free skills are
`CAT_STEALTH` and `POLICE_HOWL`. Paid skills are granted by their individual product or by
an explicitly versioned skill pack. `SKILL_PACK_01` grants `CAT_FAKE_PAW`,
`POLICE_GROUP_SEARCH`, and `POLICE_DASH`. All three also have individual products. Later skills
must be added to a new product/pack and are never appended retroactively to a pack that customers
already bought.

Skill-mode unlock progress (three completed opt-in rewarded ads) is separate from Store
ownership. Store restoration rebuilds product-derived skill and pack ownership while preserving
the independently earned permanent skill-mode unlock.

## Online match validation boundary (Phase 3)

Online skill selection is authorized only from `profile.skillEntitlements` stored by the
server. Registration and match payloads cannot import or overwrite this field. The server
converts existing runtime ability names to canonical skill IDs, records one approved ID per
role in the match, and checks skill-use events against that approved snapshot.

The current server entitlement fields are a provisional mock storage boundary. A later native
store receipt verifier must be the writer for paid grants, and a verified rewarded-ad service
must be the writer for the skill-mode unlock. Client localStorage is never purchase proof.

## Rewarded-ad unlock boundary (Phase 4)

`SKILL_MODE_UNLOCK_PROGRESS` is the only rewarded-ad type that increments skill-mode progress.
The server requires a verifier result and a stable `verificationId`, stores an idempotency marker
for that player/event, caps progress at three, and permanently sets `skillModeUnlocked` on the
third verified completion. An unverified client claim cannot update the profile. Profile loading
copies the server count and unlocked flag into the client cache for display, but online match
authorization continues to read the server profile used by Phase 3.

## Next connections

## Rewarded ads (Phase 5)

iOS uses `@capacitor-community/admob` behind `rewarded-ad-provider.js`. Debug/local builds use
Google's official iOS rewarded test unit. The production unit is not committed: production must
inject `NYAN_AD_CONFIG.rewardedAdUnitId`, set `testing=false`, set `ADMOB_REWARDED_AD_UNIT_ID` on
the Worker, set `ADMOB_SKILL_MODE_REWARD_ITEM` to the configured reward item, and configure the
AdMob SSV callback URL as `/api/ads/admob/ssv`. The endpoint fails closed while either Worker
setting is absent.

The native reward callback proves only that the local SDK awarded the view; it is not server
purchase/reward proof. Before loading, the authenticated client creates a short-lived attempt.
Its ID is passed as AdMob SSV `customData`, while the server player ID is passed as `userId`.
Google signs the SSV callback and supplies `transaction_id`. The Worker verifies the ECDSA
signature against Google's public verifier keys, checks player/attempt/ad-unit matching, and
stores an idempotent verified receipt. Only then can `/api/online/rewarded-ad-completion` consume
that attempt through the Phase 4 verifier boundary.

Google test ads intentionally do not emit SSV callbacks. Therefore a test-ad reward callback is
shown as a successful SDK test but never increments the server entitlement. Web browsers safely
show rewarded ads as unavailable. No client `success=true` or localStorage state can grant the
online entitlement.

## iOS StoreKit 2 (Phase 6)

`NyanStoreKitPlugin.swift` is the minimal Capacitor bridge for StoreKit 2. It loads the six
non-consumable products, returns Apple's localized `displayPrice`, distinguishes purchased,
cancelled, and pending results, observes unfinished transaction updates, and enumerates
`Transaction.currentEntitlements` after `AppStore.sync()` for restoration. A transaction is not
finished until `/api/online/storekit-transaction` accepts its `jwsRepresentation`.

The Worker does not trust a client purchase flag or decoded JWS claims. It extracts only the
transaction ID needed to query Apple's App Store Server API, authenticates that request with an
App Store Connect ES256 key, then compares Apple's authoritative transaction response with the
requested product, transaction, bundle, environment, revocation state, and (when present) the
player's `appAccountToken`. A global transaction marker prevents one transaction from being
claimed by multiple online profiles. The verified result is then passed through the existing
`applyVerifiedSkillEntitlement()` boundary.

Required Worker secrets/settings for Sandbox or production verification are
`APP_STORE_CONNECT_PRIVATE_KEY`, `APP_STORE_CONNECT_KEY_ID`,
`APP_STORE_CONNECT_ISSUER_ID`, and `APPLE_BUNDLE_ID=jp.nyanchase.game`. They are deliberately not
committed. The API automatically selects Apple's Sandbox or Production endpoint from the Apple
transaction environment. Local JavaScript tests use a fake native bridge and fake Apple server;
real purchase-sheet testing should use App Store Connect Sandbox products and a Sandbox Apple
Account so the server can independently re-query Apple.

This app still uses an anonymous online identity. Restore works for the same authenticated online
profile and its StoreKit entitlements. Secure cross-device reassignment to a brand-new anonymous
profile requires the later account-recovery/login phase; the server intentionally rejects a
transaction already claimed by another profile.

## Next connections

1. Configure the six non-consumables, tax/banking agreements, localization, and Sandbox testers
   in App Store Connect.
2. Install the four App Store Server API secrets on the Worker and exercise end-to-end Sandbox
   purchase, cancel, pending, restore, refund/revocation, and interrupted-transaction cases.
3. Add Google Play Billing behind the same purchase-provider and verified entitlement boundary.
4. Add account recovery before promising restoration into a newly-created anonymous profile.
## Phase 7: 正式UI

- 設定画面に「広告を3回見ると永久解放」の進捗（0/3〜2/3）と、広告の準備中・利用不可・視聴中・検証中を表示する。解放後、この導線は非表示にする。
- スキルストアには単品3種、3点パック、広告削除、広告削除＋3点パックの6商品を固定順で表示する。
- 価格はアプリ内に固定せず、StoreKitが返した `displayPrice` だけを表示する。StoreKitを利用できないWeb環境では安全に「利用不可」とする。
- 商品状態は「未購入」「購入済み」「パックに含まれる」「購入中」「利用不可」を区別する。3点パックには所有済み数と残数を表示する。
- 「購入を復元」はStoreKitを利用できる環境だけ操作可能とする。
- 能力選択では、モード未解放または未所有の能力を選択不可にし、ロック理由とストア導線を明示する。猫・警察とも1試合1能力の既存ルールは変更しない。
## Phase 8: Android広告・課金

- AndroidはGoogle公式テストRewarded Ad IDを使い、iOSと同じAdMob SSV検証境界へ接続する。
- 課金はGoogle Play Billing 9.1.0のone-time productを使う。価格・商品名はPlayの`ProductDetails`を表示する。
- `purchaseToken`はWorkerのGoogle Play Developer API検証を通し、共通entitlement付与後にacknowledgeする。
- UIは`NyanPurchases`共通providerを使用し、iOS=StoreKit、Android=Google Play、Web=利用不可を切り替える。
- Google Play購入復元はactive non-consumable purchasesを再検証し、localStorageを権威にしない。
