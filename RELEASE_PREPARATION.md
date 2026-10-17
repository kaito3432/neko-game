# 初回公開の審査準備（2026-10-13）

基準: `2802033ba83d6d04c6569c0f00317bfcad9f1404` / origin・remote online-beta一致。
作業先: coin-worker-release worktree。Desktopの旧online-betaを使用していない。
今回の変更は未commit。Production Worker・公開Legalサイトへの反映はしていない。
最新判定: **PARTIALLY READY**。Apple公式x5cチェーン検証への置換とWorkerローカル互換確認は完了。実Apple取引/OCSP成功応答・通知疎通、広告設定とRelease準備は未完了。下記13節は置換前監査の履歴、14節が最新状態。

## 1. 初回仕様と実装対応

- 公開: CPU、ローカル対人、Online Room、Collection、Daily、Shop、Skill Mode、Help、Settings、Legal。
- 非公開: Random、Rank/RP、Pass、Stamina、ランク/シーズン報酬、Master、Frame。
- Feature Flagの4項目はOFFを維持。将来機能の定義/素材/権利は削除していない。
- Rewarded Adsのみ。Banner/Interstitialの呼び出しを追加していない。
- 有料: フェイク肉球、一斉捜索、ダッシュ、3点パックの買い切り4商品。
- 無料: 忍び足、遠吠え。Skill Mode自体は検証済み広告3回で永久解放。
- REMOVE_ADS / REMOVE_ADS_PLUS_SKILL_PACK_01は初回取得・購入リストから除外。既存復元権利は維持。
- Skin Pack / subscriptionは初回販売なし。価格はStore取得。

## 2. Store ID一覧

| 内部キー / iOS Store ID | Android Store ID案 | 種別 |
|---|---|---|
| SKILL_CAT_FAKE_PAW | skill_cat_fake_paw | non-consumable |
| SKILL_POLICE_GROUP_SEARCH | skill_police_group_search | non-consumable |
| SKILL_POLICE_DASH | skill_police_dash | non-consumable |
| SKILL_PACK_01 | skill_pack_01 | non-consumable |

`store-product-ids.js`が唯一のmapping。Androidの表示価格・購入・復元・Worker照合・acknowledgementはこのmappingを使う。
非公開の広告削除商品も復元用mappingのみ残す。Console側の商品登録は未実施。

## 3. Apple購入検証と審査環境

- クライアントJWSとApple APIのJWSを独立にES256検証。クライアントから来たx5cを信頼鍵として採用しない。
- Apple公式SignedDataVerifier 3.1.0を共有し、公開Apple Root CA G3をtrust anchorにする。leaf key pinは使用しない。
- bundle、商品、environment、transaction ID、revocation、account tokenを検証する。
- Production WorkerでもApple公式署名＋Server APIで確認されたSandbox取引を受け付ける。事前playerId allowlistは不要。
- Sandbox初回購入はApple署名済みappAccountTokenが認証済み匿名プロフィールのUUIDと一致することが必須。
- `purchaseEnvironment`を保存し、同一プロフィールの環境混在を拒否する。
- 同一transaction markerの環境衝突も拒否。transaction冪等性・所有権の二重付与防止を維持。
- `Transaction.unfinished`の再検証を追加。成功前にfinishしない。
- Store障害時は権利をローカルだけで付与しない。cancel/pending/失敗UIと復元UIは維持。

最初の購入環境にプロフィールを固定。環境タグのない既存購入権利はProductionとして扱いSandboxを混ぜない。
Google購入もSandbox固定プロフィールには付与しない。refund/revokeは記録済み取引の環境で再照会。
Apple署名証明からTestFlight/App Review担当者そのものは識別できない。正当なSandbox取引は審査以外でも同じ隔離条件で扱う。
別プロフィールへのSandbox削除後復元はaccount token条件を緩めず拒否。クロスアカウント復元を有効にするなら別途安全性確認が必要。
実Apple鍵・Server API設定と実TestFlight/App Review購入確認は未実施。テスト用鍵をProductionへ設定しない。
デバイス名や審査担当者を推測して機能を切り替える処理はない。

## 4. Production Workerへ必要な設定（今回は設定していない）

| 名前 | 用途 |
|---|---|
| APP_STORE_CONNECT_PRIVATE_KEY | Apple Server API用p8秘密鍵 |
| APP_STORE_CONNECT_KEY_ID | Appleキー識別子 |
| APP_STORE_CONNECT_ISSUER_ID | Apple issuer |
| APPLE_BUNDLE_ID | jp.nyanchase.game |
| APPLE_APP_ID | 6821995143。Production通知のappAppleIdを照合する非secret値 |
| GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL | Publisher API service account |
| GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY | 上記の秘密鍵 |
| GOOGLE_PLAY_PACKAGE_NAME | jp.nyanchase.game |
| GOOGLE_PUBSUB_PUSH_EMAIL / GOOGLE_PUBSUB_PUSH_AUDIENCE | RTDN push認証の送信者/audience |
| PURCHASE_REVOKE_RETENTION_DAYS | 失効記録の保持設定。公開Legal方針と人間が照合する |
| ADMOB_REWARDED_AD_UNIT_IDS | iOS/Android両方の正式Rewarded Unit IDをカンマ区切りで許可する。単一旧設定も互換維持 |
| ADMOB_SKILL_MODE_REWARD_ITEM | 正式値 `skill_mode_unlock`。iOS/AndroidのAdMob Consoleのreward itemと一致させる。報酬用途はサーバーattemptで判定 |

### AdMob SSV Console URL verification

- ConsoleのUser IDとCustom dataには、どちらも `admob_ssv_verification` を完全一致で入力する。
- Console確認の固定 `ad_unit=1234567890` は上記identity一致時だけ別枠で許可する。通常SSVの実広告allowlistには追加しない。Google署名・公開鍵・timestamp・transaction ID・正式報酬の検証は必須。一時診断ログ・診断flagは正式versionから除去する。
- 通常広告・確認用ともreward amountは `1`、reward itemは `skill_mode_unlock`。iOS/Androidで共通利用する。
- Google公開鍵・ECDSA署名、許可広告unit、報酬item/amount、transaction ID、timestampを検証した場合のみ確認用リクエストを200で受理する。署名対象queryは並べ替え・再エンコードしない。
- 確認用は署名検証後に即returnし、attempt照合・storage read/write・報酬receipt・プロフィール・コイン・スキル進捗に一切触れない。通常のserver-issued attemptとtransaction冪等処理は維持する。
- Productionの実Ad Unit IDとreward item設定が未確定なら、仮IDやテストIDで埋めず、設定確定と明示的なdeploy承認を待つ。

AdMob SSVはGoogleのECDSA公開鍵で検証する設計。架空の「SSV Secret」を追加する必要はない。
AdMob ConsoleでSSV callbackを `https://nyan-chase-online.honda19990602.workers.dev/api/ads/admob/ssv` へ設定。
playerId/attemptIdをuserId/customDataに渡し、検証済みattemptだけ付与。3回解放、Daily50coin、二重付与防止は既存コード・テストを維持。
Store Notification URL、Appleキーrotation、Google API権限、課金契約も設定・検証が必要。

## 5. 広告とReleaseビルド

本番IDを捏造せず、`node scripts/prepare-web-assets.cjs --release`で以下を検証する。Android IDは末尾の確定設定を既定値とし、iOS IDは従来どおり明示入力する。

`--platform ios` / `--platform android` は対象OSの本番IDだけ必須。省略または `--platform both` は両OS必須。対象外OSのIDは生成しない。同期も `capacitor copy ios` / `capacitor copy android` で対象OSに限定し、未準備OSのassetsは上書きしない。各OSのRelease guardは対象OSのmanifest・本番IDを検証する。

- NYAN_ADMOB_IOS_APP_ID / NYAN_ADMOB_ANDROID_APP_ID
- NYAN_ADMOB_IOS_REWARDED_ID / NYAN_ADMOB_ANDROID_REWARDED_ID
- NYAN_AD_CHILD_DIRECTED / NYAN_AD_UNDER_AGE: true/false。対象年齢に応じ人間が決定する。
- NPAはRelease既定true。NYAN_AD_NPA=falseを拒否し、実広告リクエストもnpa=trueを強制。
- NYAN_AD_MAX_RATING: General / ParentalGuidance / Teen / MatureAudience。人間が決定する。

空欄/形式不正/Google sample publisherを拒否。環境変数はローカルシェル・CI secret管理で渡す。値をGitに保存しない。
NPA指定だけではTracking=Noと断定しない。iOS起動前設定でPPT disabled・publisher first-party ID off、Androidはfirst-party ID off・AD_ID permissionをmanifest mergeで除去。
コードからATT認可をリクエストしない。UMPは維持し、同意拒否時に迂回して広告をロードしない。
AdMob ConsoleでIDFA explainerを無効、first-party data利用を無効、mediation設定を確認する。実SDK通信・同意別挙動の確認が必要。
設定→不適切な広告を報告する→Supportの報告窓口を追加。
UMP情報取得→必要な同意フォーム→canRequestAds→SDK初期化の順序を維持。
広告はユーザーが押した任意視聴。閉じた/失敗/no-fill/未検証では正式報酬を付与しない。

### 同期とguard

1. Debug: `node scripts/prepare-web-assets.cjs`。
2. Release: 上記値を用意し、`node scripts/prepare-web-assets.cjs --release`。
3. `npx cap copy ios` / `npx cap copy android`。
4. iOS Release時に実iOS App IDを `NYAN_ADMOB_APP_ID` build settingへ指定。
5. Android Release時に `-PNYAN_ADMOB_APP_ID` と下記署名環境変数を指定。

source/bundled SHA256 manifestで、HTML/CSS/JSの古い同期・改変を検出する。
Release HTMLから開発モックUIとdebug scriptを除去。Release準備では生成www/debugのみ除去し、正式ソースのQA補助ファイルは削除しない。
iOS build phase・Android preReleaseBuildがテスト広告/未同期資産を拒否する。
NodeがXcodeから見えない場合はNYAN_NODE_BINARYを設定。
未設定の対象OSの本番ID、年齢方針、署名設定があればRelease生成は意図的に停止する。Debug生成物は提出用ではない。

## 6. iOS / Androidネイティブ監査

| 項目 | 状態 |
|---|---|
| iOS ID / Version / Build | jp.nyanchase.game / 1.0 / 13。Consoleの使用済み番号と照合必要 |
| iOS target / devices | 15.0 / iPhone+iPad |
| orientation | iPhone縦、iPad4方向 |
| signing | Automatic / Team設定あり。Distribution provisioningは未確認 |
| capabilities | IAPのみ明示有効。不要Capabilityは追加していない |
| ATS | アプリ固有の例外なし。HTTPS Production endpoint |
| WebView | Capacitor 8.5.0 / WKWebView、Android BridgeActivity / WebView |
| Android ID / versions | jp.nyanchase.game / versionName1.0 / versionCode1 |
| Android SDK | min24 / target36 / compile36 |
| Android signing | 環境変数でRelease upload keyを渡す構成を追加。実鍵未提供 |
| AAB / merged manifest | このMacにJava runtimeがなく未生成。WindowsでRelease build・manifest確認が必要 |

Android署名環境変数: NYAN_UPLOAD_KEYSTORE / NYAN_UPLOAD_STORE_PASSWORD / NYAN_UPLOAD_KEY_ALIAS / NYAN_UPLOAD_KEY_PASSWORD。
INTERNET、ACCESS_NETWORK_STATEはsource/依存で確認。GMA由来AD_ID/AdServices等は最終Release manifest確認待ち。
camera/microphone/GPS/contactsの独自利用なし。exported MainActivityはlauncher、FileProviderは非exported。
allowBackup=trueは既存のまま。credential復元・再インストール時の仕様を実機で確認する。

## 7. Privacy Manifest / ATT

- アプリ独自SwiftにはRequired Reason API呼び出しを見つけなかった。架空のUserDefaults理由を追加していない。
- App PrivacyInfoに独自のUser ID / Gameplay / Purchase Historyをlinked=true、app functionality目的として申告。
- アプリ独自tracking=falseは独自コードに対する宣言。広告SDKを含めたApp Store全体のTracking=Noを意味しない。
- Debug生成物にApp / Capacitor / Cordova / GMA / UMPのmanifestを確認。
- GMA: SystemBootTime 35F9.1 / UserDefaults CA92.1 / DiskSpace E174.1。
- UMP: UserDefaults CA92.1。Capacitor/CordovaのAccessedAPITypesは空。
- plist構造検査PASS。最終Release archiveの全bundleとXcode Privacy Reportは未確認。
- 初回方針はTrackingなし/ATTなしを目標とする非パーソナライズ配信。ATT prompt/usage descriptionは未追加。
- 確定判定: Tracking **Human decision required**、ATT **Human decision required**、personalized ads **No**（要求設定）。Console/Release通信未確認のためTracking=Noの申告はまだ確定しない。
- App Store Privacy案: User ID / Purchase History / Gameplayをapp functionalityとして申告。広告SDKのIP由来概略位置、identifier、広告操作、診断等はGoogleの版別開示と実測に合わせる。Tracking回答は上記確認後にNo、追跡が残るならATT実装が必要。
- Google Data Safety案: User ID / 購入履歴 / gameplay、およびSDKの概略位置・device/other IDs・広告操作・診断の収集/共有を確認して申告。AD_ID削除を「全identifier収集なし」と解釈しない。通信暗号化・アプリ内削除経路を申告。

## 8. Privacy / Data Safety回答案（確定申告ではない）

「SDK要確認」は広告同意・公開設定・版に基づく実測が必要。「委託」はConsoleのservice provider定義との照合が必要。

| Data | collected | linked | tracking | purpose | shared | source / retained | deletion |
|---|---|---|---|---|---|---|---|
| Name | 通常なし | — | なし | — | — | 入力なし。問い合わせ本文は利用者次第 | support対応 |
| Email | support時 | 連絡先に紐付く | なし | support | メール事業者/委託要確認 | support mailbox | support依頼 |
| Phone | 独自なし | — | — | — | — | 独自入力なし | — |
| User ID | はい | はい | 独自なし/SDK要確認 | app/security | 対戦相手へ必要なID、Cloudflare委託 | credential hash/playerId、DO/cache | アプリ内削除、最小購入記録は保持 |
| Device ID | SDK | SDK要確認 | SDK要確認 | ads/security | Google | SDK/Google保持条件 | Google手段確認 |
| Advertising ID | SDK/OS許可依存 | SDK要確認 | 要確認 | ads/measurement | Google | SDK/Google | OS設定/Google確認 |
| IP | infrastructure/SDK | 要確認 | SDK要確認 | network/security/ads | Cloudflare/Google | インフラ/SDKログ | 設定/提供者保持条件 |
| Purchase History | はい | はい | 独自なし | entitlement/restore/fraud | Apple/Google、Cloudflare委託 | DO最小記録、Store | 一部保持、削除案内参照 |
| Gameplay | はい | はい | 独自なし | game/Daily/Coin | 相手へ対戦情報、Cloudflare委託 | DO/cache | アプリ内削除、過去試合/ログの保持は別 |
| Product Interaction | SDK | 要確認 | 要確認 | ads/analytics | Google | SDK/Google | 提供者確認 |
| Crash Data | SDK | 要確認 | 要確認 | diagnostics | Google | SDK/Google | 提供者確認 |
| Performance | SDK | 要確認 | 要確認 | diagnostics/ads | Google | SDK/Google | 提供者確認 |
| Other Diagnostics | SDK/infra | 要確認 | 要確認 | reliability/security | Google/Cloudflare | ログ/提供者 | 保持設定確認 |
| Approximate Location | IP由来SDK候補 | 要確認 | 要確認 | ads/security | Google | SDK/Google | 提供者確認 |
| Precise Location | 独自なし | — | — | — | — | GPSなし | — |
| Photos | なし | — | — | — | — | ゲーム素材はユーザー写真ではない | — |
| Camera | 独自なし | — | — | — | — | API/permissionなし | — |
| Microphone | 独自なし | — | — | — | — | API/permissionなし | — |
| Contacts | 独自なし | — | — | — | — | API/permissionなし | — |

## 9. Legal / deletion / offline

公開URL: https://kaito3432.github.io/neko-game/{privacy,terms,support,data-deletion}.html 。既存4URLの200は前監査で確認。
今回は同梱sourceのみ修正。公開サイトには未反映。
内部向け「公開前」文言を除去。初回4商品の買い切り/Rewardedのみ/非公開機能は提供しないことを明記。
将来名が残る箇所は保存・既存権利・削除の説明であり、現在提供するとの誤認を避ける。
準拠法等の最終法的確認、nyanchase@gmail.comの運用は人間確認。
匿名credentialはlocalStorage、サーバーはhash認証。削除は本人認証・二段階確認、対戦中拒否、offline不可。
アンインストールでサーバー削除にはならない。再インストールで旧credentialを失った場合、旧プロフィールを自動復元する保証はない。
Store復元はユーザー操作・検証必須。コイン等のゲーム進行はStore復元対象ではない。
通信timeoutは既存15秒、reconnect試行は既存の高速処理を維持。初期offlineのHome表示、所有品cacheの利用設計は維持。
実端末の全障害注入、実Store unavailable/no-fillは未再確認。unitの失敗/cancel/pending/未検証拒否で代表確認。

## 10. メタデータ案（Console入力なし）

- App name: にゃんチェイス
- Apple subtitle: ネコと柴犬のかくれんぼ対戦
- Google short description: ネコを逃がす？柴犬で見つける？CPU・同じ端末・部屋対戦で遊べる追いかけっこ。
- Apple keywords案: ネコ,柴犬,かくれんぼ,対戦,ボードゲーム,推理,CPU
- Category案: Games / Board・Strategy。Consoleで最終選択。

### Full description案

ネコを逃がす？それとも3匹の柴犬警察で見つける？
にゃんチェイスは、ダンボールに隠れたネコと柴犬警察の追いかけっこ対戦ゲームです。
CPU対戦で練習したり、1台の端末で交互に遊んだり、部屋番号を共有して離れた相手と対戦できます。
Collectionではキャラクターや街・盤面の着せ替えを楽しめます。Dailyで獲得するにゃんコインはゲーム内アイテムに使えます。
Skill Modeは、任意のリワード広告をサーバーで3回確認すると永久解放されます。
忍び足・遠吠えは無料スキルです。フェイク肉球・一斉捜索・ダッシュは別途買い切り購入が必要で、3点パックも用意しています。
部屋対戦では、どちらか一方がスキル利用権を持っていれば、2人ともスキルを使えます。
オンライン対戦、広告視聴、購入、サーバー報酬の受取には通信が必要です。

### Review notes案

メール/パスワード登録は不要。匿名プロフィールを使用します。
Home→Shop→ネコ/警察→スキル詳細、または3点パックからIAPを確認できます。「購入を復元」はShop下部。
Home→オンライン対戦→部屋対戦。別端末で6桁の部屋番号を入力します。Random/Rank/Pass/Staminaは本版で提供しません。
Home→設定→データとプライバシーで削除可能。広告報告・Privacy・Terms・Supportの導線あり。
OSレビューはRoom正常完了3/15/50戦と7/30日の間隔条件。報酬/星5誘導/独自評価画面はありません。
**審査購入環境の説明は方式確定後に追記し、この未確定notesのまま提出しない。**

## 11. 年齢/コンテンツ回答案

| 項目 | コード/機能上の案 | 人間確認 |
|---|---|---|
| realistic violence/blood | 対応機能なし | 全提出画像の目視 |
| cartoon violence/fear | 追跡/捕獲のコミカル表現。頻度・強度は画像で回答 | 必要 |
| gambling/simulated gambling | 賭け/現金換金機能なし | 最終質問票 |
| loot box/paid random item | なし。町の木箱は固定30coinの着せ替えでランダム抽選ではない | 名称と画面説明の一致 |
| user communication/chat | チャット/自由投稿なし | 対戦画面確認 |
| UGC | 既定のキャラクター/装備共有。自由な画像アップロードなし | Consoleの定義で回答 |
| unrestricted web access | 任意URL入力なし。Legal外部リンクあり | WebView/外部ブラウザ挙動確認 |
| advertising | Rewardedあり | 同意/内容rating/対象年齢 |
| purchases | non-consumable4商品。Coin現金販売なし | 実Store登録 |
| online multiplayer | Roomあり | 審査説明/スクリーンショット |

具体的な年齢数値は決め打ちしない。Apple/IARCの現行質問票による算定結果と、Kids/Families対象方針を人間が確認する。
公開スクリーンショットは初回公開の実画面のみ。非公開機能を載せない。

## 12. 実行結果と残タスク

- iOS Debug native compile成功、App manifestとSDK manifestsを生成物で確認。
- Blocking対応: unit 588/588 PASS、JS/MJS/CJS syntax 183ファイルPASS。iOS Debug native compile PASS。Android native build/merged manifestは環境未準備で未確認。
- root/www/iOS public/Android publicのWeb資産56ファイルをhash照合し一致。これはDebug用同期で、提出用Releaseではない。
- Worker bundle dry-run PASS。Production upload/deployは行っていない。
- DELETEは/api/online/profileのみ。許可Originはcapacitor://localhost、https://localhost、http://localhost、https://kaito3432.github.io。null/その他Origin・余分なpreflight header・他endpoint DELETEは拒否。Bearer認証必須、既存DOの自己削除処理を維持。GET/POST一般CORSは変更なし。
- Release Archive / signed AAB / Release merged manifestは未完了。実広告ID・署名・Java/Android環境が必要。
- Home/Collectionは基準commitで390x844、768x1024、960x1440、1032x1376、1280x800確認済み。今回geometryは未変更。
- 独立Analytics/Crash reporting SDK追加なし。
- tracked sourceに秘密鍵・keystoreを埋め込まない。p8/p12/jks/keystore/.env/.dev.varsのignoreを追加。
- 今回の3項目のうちコード対応は完了、残Blockingは広告Tracking/ATTの外部設定・実測確認1項目。加えて実Store鍵/広告ID/署名済みReleaseなど従来の公開準備は残る。
- Production設定・実Store取引・署名済みRelease・Privacy申告の確認完了前にはREADYとしない。

### 今回変更した正式ソース（生成物除外）

- `.gitignore`, `index.html`, `service-worker.js`, `monetization-ui.js`
- `store-product-ids.js`, `storekit-provider.js`, `google-play-provider.js`, `rewarded-ad-provider.js`
- `server/worker.mjs`, `server/online-profile.mjs`, `server/storekit-verification.mjs`, `server/google-play-verification.mjs`
- `server/store-notification-auth.mjs`, `server/store-notifications.mjs`, `server/rewarded-ad-verification.mjs`
- `server/profile-deletion-cors.mjs`
- `ios/App/App/NyanStoreKitPlugin.swift`, `ios/App/App/PrivacyInfo.xcprivacy`, `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/AppDelegate.swift`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/java/jp/nyanchase/game/MainActivity.java`
- `scripts/prepare-web-assets.cjs`, `scripts/validate-generated-web.cjs`, `scripts/validate-ios-release.sh`
- `privacy.html`, `terms.html`, `support.html`, `data-deletion.html`
- `tests/storekit-provider.test.js`, `tests/google-play-provider.test.js`, `tests/server-storekit.test.js`, `tests/server-google-play.test.js`
- `tests/purchase-restore.test.js`, `tests/server-admob-ssv.test.js`, `tests/release-config.test.js`, `tests/release-store-ids.test.js`, `tests/review-apple-verification.test.js`
- `tests/profile-deletion-cors.test.js`, `tests/rewarded-ad-provider.test.js`
- `tests/store-notifications.test.js`
- 本書 `RELEASE_PREPARATION.md`

参考（最終回答は現行Console/SDK版で照合）:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/
- https://support.google.com/googleplay/android-developer/answer/1153481
- https://developers.google.com/admob/ios/privacy/data-disclosure
- https://developers.google.com/admob/android/privacy/play-data-disclosure
- https://developers.google.com/admob/ios/privacy/strategies
- https://developers.google.com/admob/ios/targeting
- https://developers.google.com/admob/android/privacy/strategies
- https://developer.apple.com/app-store/user-privacy-and-data-use/

## 13. 置換前監査の履歴（下記14節で解消、2026-10-13）

基準HEAD: 2802033ba83d6d04c6569c0f00317bfcad9f1404。未commit変更43ファイル（上の一覧）。App Store Connect商品・価格・Availability・契約状態はユーザー確認済み情報として扱い、今回は変更していない。

### 差分分類

- A 初回公開に必要: store-product-ids.js、google-play-provider.js、storekit-provider.js、index.html、service-worker.js、server/google-play-verification.mjs、server/online-profile.mjs、server/worker.mjs、rewarded-ad-provider.js、ios/App/App/AppDelegate.swift、ios/App/App/NyanStoreKitPlugin.swift、ios/App/App/PrivacyInfo.xcprivacy、ios/App/App.xcodeproj/project.pbxproj、android/app/build.gradle、android/app/src/main/AndroidManifest.xml、android/app/src/main/java/jp/nyanchase/game/MainActivity.java、privacy.html、terms.html、support.html、data-deletion.html。
- B 安全性改善: .gitignore、monetization-ui.js、scripts/prepare-web-assets.cjs、scripts/validate-generated-web.cjs、scripts/validate-ios-release.sh、server/profile-deletion-cors.mjs、server/rewarded-ad-verification.mjs、server/storekit-verification.mjs、server/store-notification-auth.mjs、server/store-notifications.mjs。Apple署名検証部分は下記Blocking解消後に採用する。
- A/Bの検証: tests/google-play-provider.test.js、tests/purchase-restore.test.js、tests/rewarded-ad-provider.test.js、tests/server-admob-ssv.test.js、tests/server-google-play.test.js、tests/server-storekit.test.js、tests/storekit-provider.test.js、tests/store-notifications.test.js、tests/profile-deletion-cors.test.js、tests/release-config.test.js、tests/release-store-ids.test.js、tests/review-apple-verification.test.js。
- C 任意: RELEASE_PREPARATION.md（運用・監査用。アプリ機能ではなく、機密情報なし）。
- D 将来機能の追加差分なし。既存REMOVE_ADS/Passの復元定義は過去権利保護のため残す。新規販売は4商品に限定。既存ゲーム・Coin/Daily/Review・Feature Hideの別作業変更なし。

### Apple署名検証の重大Blocking

現在のAPPLE_NOTIFICATION_PUBLIC_KEYS/SPKI方式は、独立に信頼した鍵とのES256一致しか検証しない。x5cのチェーン、Apple Root CA、証明書の有効期限、leaf/intermediateの用途OID、失効を検証しない。証明書rotationに自動追随できない。固定leaf鍵の手動登録をProduction構築手順にしてはいけない。

Apple公式SignedDataVerifierは、独立に取得したApple Root CAをtrust anchorとし、x5cのleaf/intermediateをチェーン検証、Apple用途OID・日付を確認してJWSを検証する。オンラインチェック有効時はOCSPも確認する。Production通知はbundleId/appAppleId/environmentを照合する。今回不足していたappAppleId照合とテストだけを追加した。

公式方式への置換は未完了。公式Nodeライブラリはcrypto/X509Certificate・jsrsasign・node-fetchを使うため、Cloudflare Worker上での対応とOCSP動作を確認した実装が必要。今回、疑似チェーン検証を追加したり、証明書検証を省略して正式化したりしていない。

APPLE_NOTIFICATION_PUBLIC_KEYS等は**現在コードでは必要だが、正式設計の推奨設定ではない**。Root CA方式へ置換後はleaf/SPKI secret不要。Root CAは公開証明書でsecretではない。APPLE_APP_ID=6821995143は非secretの識別値。

参照: https://github.com/apple/app-store-server-library-node/blob/main/jws_verification.ts

### その他確認結果

- IAP用JWT生成はES256/bid/aud/300秒で適合。APP_STORE_CONNECT_*は名称互換を維持し、管理API Team KeyではなくIAP Keyを入れるコメントを追加。
- Sandbox匿名初回購入は署名済みaccount tokenと認証プロフィールを照合。事前allowlist不要。receipt markerとprofile environmentで二重付与・環境混在を拒否。ただし署名チェーン修正前なので実App Review購入成功を保証しない。
- 販売4商品、価格はStore取得。160/380円をコードへハードコードしない。過去6商品restoreと将来catalogを新規販売とは分ける。
- Rewardedのみ、NPA強制、first-party ID OFF、Skill Mode3回・SSV冪等性維持。Tracking/ATTは本番AdMob設定後の実機確認が残る。
- Web root57ファイル比較ではrewarded-ad-provider.jsのみwww/iOS/Androidと不一致。Production Release資産は生成していない。Release manifest対象をassets以下（画像・音声等）へ拡張し、新規/変更資産の未同期も検出するよう修正。
- Legalの提供機能整合は改善。法務文の妥当性、公開URLの実配信、運営者の表示要件は人間確認を残す。コードテストを法務承認の代わりにしない。
- 全unitと構文/dry-run/Debug compile成功は、実Apple証明書・OCSP・実Store購入の検証成功ではない。

正式commit推奨: **不可（Apple署名方式Blockingが残る）**。Production secretをまだ投入しない。Tracking、実広告ID、Release署名/同期、Store実取引、Notifications V2疎通も別途必要。

## 14. Apple公式signed data検証への置換（最新）

- @apple/app-store-server-library 3.1.0（lockfile固定）のSignedDataVerifierを使用。XCODE/LOCAL_TESTINGの署名省略モードを受け付けない。
- 公開AppleRootCA-G3.cerをApple公式PKIから取得。subject=Apple Root CA - G3、SHA256=63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179、期限2039-04-30。指紋・CA flag・自己署名をコードとテストで確認。
- x5cは3要素。公式ライブラリがleaf→intermediate→独立したtrusted Root、CA flag、Apple用途OID（leaf 1.2.840.113635.100.6.11.1/intermediate 1.2.840.113635.100.6.2.1）、証明書期限、JWS署名を検証。x5c中のrootを信頼基点に採用しない。
- alg=ES256を明示限定。bundle/environment、取引ID/元取引ID、商品、purchaseDate/signedDate、所有タイプ、token形式、revocationを検証。通常購入は初回4商品のみ。既存REMOVE_ADS等はrestore/既知取引ライフサイクル専用で維持。
- Production appAppleIdは通知payloadで6821995143に照合。transaction payloadにはappAppleIdがなく、Apple公式に従いbundle/environmentを照合する。
- Production/Sandboxともonline certificate checks=true。leafとintermediateのOCSP検証は公式実装のまま。ネットワーク/非2xx/timeoutはretryable（503）として返し、finish/権利付与をせず再送可能。hard validation errorは拒否。
- Worker互換: nodejs_compat使用。jsrsasignのglobal random初期化を避けるためrequest内lazy import。公式node-fetchのworkerd interopエラーを確認したため、aliasでWorker標準fetch＋Response.buffer＋30秒timeout互換層へ置換。証明書/OCSP ASN.1・署名検証ロジックは改変していない。
- 通知はouter、nested signedTransactionInfo、存在するsignedRenewalInfoも検証。UUID重複防止と7日signedDate窓、既存refund/revoke再照会を維持。subscription機能追加なし。
- 旧APPLE_NOTIFICATION_PUBLIC_KEYS / APPLE_NOTIFICATION_PUBLIC_KEY_SPKIのserverコード参照は削除済み。Productionから削除するのは別途承認後。今回はsecret変更なし。
- Secret: APP_STORE_CONNECT_PRIVATE_KEY（IAP key）。非secret config: APP_STORE_CONNECT_KEY_ID / APP_STORE_CONNECT_ISSUER_ID / APPLE_BUNDLE_ID / APPLE_APP_ID / NYAN_ENVIRONMENT。管理API Team Keyとは分離。Root CAは公開証明書。
- テスト用Root/鍵は毎回生成しtests専用のexplicit verifier引数へ渡す。Worker HTTP/body/envに任意Rootを受け入れる設定はない。Production online checksをOFFにする設定もない。
- Worker dry-run: 1166.29 KiB / gzip214.28 KiB。workerd runtimeで公式verifier import/Apple Rootロード/crypto、valid test chain成功、untrusted Root拒否、OCSP接続障害がretryable status2になることを確認。
- 実Apple取引はまだないため、実取引の検証とApple OCSP good response、Notifications V2実疎通は未確認。そこをローカル生成chain成功と混同しない。
- 今回変更: server/apple-signed-data.mjs、apple-root-certificates.mjs、apple-node-fetch.mjs、store-notification-auth.mjs、storekit-verification.mjs、package.json/package-lock.json、wrangler.jsonc/wrangler.sandbox.jsonc、tests/apple-chain-fixture.cjs、apple-signed-data.test.js、apple-node-fetch.test.js、review-apple-verification.test.js、store-notifications.test.js、server-storekit.test.js、本書。
- 証明書チェーン方式のコードBlockingは解消。コードcommitはユーザー承認後に可能だが、アプリ公開READYではない。Production deploy/secret/Apple側変更/commit/pushなし。
- 最終検証: 全unit601/601 PASS、JS/MJS/CJS構文189ファイルPASS、diff check PASS、Worker dry-run/runtime PASS、production依存npm audit既知脆弱性0件。jsrsasignにはnpmのmaintenance警告があるため、Apple公式library更新時に依存も継続監視する。

公式取得元: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
公式検証実装: https://github.com/apple/app-store-server-library-node/blob/main/jws_verification.ts

## Android本番広告ID（2026-10-18確定）

`config/admob.android.production.json`に承認済みAndroid App ID / Rewarded IDを保持する。
これは公開識別子であり、署名秘密情報は含めない。iOS設定は変更しない。

- `scripts/prepare-web-assets.cjs --release --platform android` はAndroid IDをこのファイルから取得する。
- `NYAN_ADMOB_ANDROID_APP_ID` / `NYAN_ADMOB_ANDROID_REWARDED_ID` でも供給可能だが、承認済み設定と異なる値は拒否する。
- Android Gradle ReleaseのApp IDも同じファイルを読む。`-PNYAN_ADMOB_APP_ID` または `ORG_GRADLE_PROJECT_NYAN_ADMOB_APP_ID` を供給する場合も承認済みApp IDとの一致が必要。
- Debug既定は従来どおりGoogleテストApp ID/テスト広告。Manifest検査で本番App IDを明示供給する場合も、実広告ロードは行わない。
- `NYAN_AD_CHILD_DIRECTED` / `NYAN_AD_UNDER_AGE` / `NYAN_AD_MAX_RATING` は未確定。ID確定だけではRelease生成できず、既存の年齢・署名ガードを維持する。
- NPA=true、AD_IDのmanifest除去、SSV署名/ユーザー/試行/広告ユニット/報酬検証、IAP保護は変更しない。
- SSV callback: `https://nyan-chase-online.honda19990602.workers.dev/api/ads/admob/ssv`。AdMob側で設定済み。
- Workerは `ADMOB_REWARDED_AD_UNIT_IDS`（カンマ区切り）を優先し、なければ単数 `ADMOB_REWARDED_AD_UNIT_ID` を参照する。本番設定へAndroid広告ユニットが未登録なら、iOS広告ユニットを残して両方を許可する設定が別途必要。今回Worker設定/deployは行わない。
- `ADMOB_SKILL_MODE_REWARD_ITEM` はAdMob側の `skill_mode_unlock` と一致させる必要がある。SSV実検証まで報酬を付与しない。
