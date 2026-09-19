# Android 広告・課金設定（Phase 8）

## ローカル構成

- Application ID: `jp.nyanchase.game`
- Google Play Billing Library: `9.1.0`
- 商品種別: one-time product（非消耗型）
- Debug AdMob App ID / Rewarded ID: Google公式テストID
- 本番IDはソースへ保存せず、リリース用resource／設定生成工程から注入する。

## Worker Secret / 設定

- `GOOGLE_PLAY_PACKAGE_NAME`: `jp.nyanchase.game`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`: Google Play Developer APIへアクセスするサービスアカウントのメール
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`: 同サービスアカウントJSONのPKCS#8秘密鍵（改行を含む値または `\\n` 形式）
- 既存AdMob SSV: `ADMOB_REWARDED_AD_UNIT_ID`, `ADMOB_SKILL_MODE_REWARD_ITEM`

サービスアカウントJSON全体は保存しない。OAuth scopeは `androidpublisher` のみに限定する。

## Google Play Consoleで後から行うこと

1. アプリ `jp.nyanchase.game` を作成し、署名済みテストビルドを内部テストへ公開する。
2. 6つのone-time productを、Web/iOSと同一product IDで登録・有効化する。
3. ライセンステスターと内部テスターを登録する。
4. Google CloudサービスアカウントをPlay Consoleへリンクし、注文・購入確認に必要な最小権限を付与する。
5. AdMob AndroidアプリとRewarded ad unitを作り、SSV callbackを `/api/ads/admob/ssv` に設定する。
6. Release用AdMob App ID / Rewarded IDとWorker Secretを安全なデプロイ設定から注入する。

## 信頼境界

端末の購入成功は権利にならない。Workerが `purchases.productsv2` で `PURCHASED`、product ID、package、アカウントを確認し、共通の `applyVerifiedSkillEntitlement()` を通した後だけ権利を付与する。purchase tokenはハッシュ化したmarkerで冪等化し、検証後にacknowledgeする。
