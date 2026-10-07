# にゃんチェイス リリース準備台帳（2026年10月7日）

基準：`online-beta` / `c394bfef7f95afc8c1b3a4fc224ce056af3575f0`。この文書は作業状態を示し、Store申告や公開を承認するものではない。回答案は `STORE_SUBMISSION_CHECKLIST.md`、個人情報の扱いは `APP_PRIVACY_DISCLOSURE.md` を参照。

現状：**LEGAL CONTENT: PASS**、**WINDOWS LOCAL QA: PASS**、**LOCAL RELEASE PREP: PENDING**（Mac/iOS無料QAと正式提出bundle未完了）、**STORE CONSOLE: PENDING 8件**。ConsoleだけでなくMacで無料実施できる残件もあるため、LOCAL RELEASE PREPを先にPASSへしない。

## LOCAL READY（Windowsで無料確認済み）

- [x] 法務4ページとCSSがHTTPS 200。施行日 `2026年10月7日`、メール、リンク、プレースホルダーを確認。
- [x] `node scripts/check-legal-release.cjs`：法務文書PASS、Store申告PENDING 8件を別表示。
- [x] JDK 21で `android/gradlew.bat bundleRelease` 成功。`android/app/build/outputs/bundle/release/app-release.aab`（約223 MB）を生成。これは**未署名かつGoogle公式テスト用AdMob App ID**の検証用bundleであり提出不可。
- [x] Release merged manifestの権限・exported component・provider/serviceを監査。結果は下記。
- [x] Release runtime dependency：Google Mobile Ads `25.4.0`、UMP `4.0.0`、Billing `9.1.0`、Capacitor Android `8.5.0`、AdMob plugin `8.1.0`。
- [x] テスト用emulator-5554でUMP debug geography：EEAは `REQUIRED / canRequestAds=false`、USは `NOT_REQUIRED / true`、OTHERは `NOT_REQUIRED / true`。EEAのテスト同意画面を表示。アプリ側はフォーム中 `required / false`、完了後 `obtained / true`、privacy optionsボタン表示を確認。USはprivacy options画面を開けた。最後に地域強制を外して `not_required / true` へ戻した。これはGoogleの **Publisher Test Ads** messageであり、本番AdMobメッセージの検証ではない。
- [x] リワード広告の同意ゲート・Skill Mode・スタミナ・server verificationを含む既存自動テストを再実行（最終件数は作業報告に記録）。

## 無料で残る実機・Mac側確認

- [ ] `IOS_PREPAID_RELEASE_QA.md` をMac/Xcodeで実行。WindowsではiOS Simulator build不可。
- [ ] Android公開候補のWeb assetsを正式手順で再同期し、公開直前bundle内容を再検査。今回のAABは現行Android publicを梱包したビルド検証結果。
- [ ] Store用スクリーンショットを実画面から撮影し、誇張・個人情報・テスト広告表示を除去。

## Google Play登録後／提出前

- [ ] 対象年齢、IARC、Data Safety、アカウント削除URL、広告ID利用申告を `STORE_SUBMISSION_CHECKLIST.md` と照合して入力。
- [ ] Play App Signing用のupload keyを安全な保管場所で用意し、upload署名済みAABを作る。keystoreとpasswordをrepoへ置かない。
- [ ] 正式versionCode/versionName、公開用AdMob App ID/広告ユニット、課金product IDとsubscription/base planを確認。現在のAABはversionCode 1・versionName 1.0・テストApp ID。
- [ ] Google PlayのテストトラックでBilling、復元、購読、返金、広告同意とData Safety表示を確認。

## Apple Developer加入後／提出前

- [ ] App Store ConnectでAge Rating、App Privacy、IAP/Subscription、サポート・法務URLを回答案と照合。
- [ ] distribution signing、Bundle ID、正式広告ID、StoreKit商品と購読、実機のUMP/ATT/IDFA挙動を確認。
- [ ] Archive/TestFlightとApp Review用素材・スクリーンショットを確認。

## Production deploy前

- [ ] `server/wrangler.jsonc` のWorker名・binding・compatibility dateを再監査し、既存Durable Object namespaceを維持。
- [ ] `PRODUCTION_SECRETS_CHECKLIST`（`STORE_SUBMISSION_CHECKLIST.md` 内）を値を出さずに確認。実値は本番設定へ安全に投入。
- [x] Support admin deletion path のpreview/execute、認証、確認token、既存削除transaction再利用、監査とfixtureテストを実装。Productionでは無効。
- [ ] `PROFILE_DELETION_RUNBOOK.md` の権限付き手動削除運用を確定し、Production secret/有効化、deploy、専用QA profileでの限定live QA、運用開始判定を実施。現在Production secret未設定・enabled=false・未deploy・live QA未実施。`PURCHASE_RETENTION_RUNBOOK.md` の365日方針を確認。現状では監査の自動cleanupを有効化しない。

## Android Release manifest監査結果

- package `jp.nyanchase.game`、minSdk 24、targetSdk 36。`INTERNET`、`ACCESS_NETWORK_STATE`、`BILLING`、`AD_ID`、`ACCESS_ADSERVICES_AD_ID`、`ACCESS_ADSERVICES_ATTRIBUTION`、`ACCESS_ADSERVICES_TOPICS`、`WAKE_LOCK`、`FOREGROUND_SERVICE`、WorkManager用signature permissionを含む。
- location、contacts、camera、microphone、storage、phone、SMS、Bluetoothのpermissionは確認されない。MRAID広告処理向けのSMS・DIAL intent visibilityは**permissionではない**。
- exported `true`：起動用 `MainActivity`、AndroidX WorkManagerの `SystemJobService`（`BIND_JOB_SERVICE`保護）、`DiagnosticsReceiver` と `ProfileInstallReceiver`（`DUMP`保護）。その他の広告activity、provider、serviceは原則 `exported=false`。公開前に依存SDK由来componentの必要性を再確認。
- `FileProvider` と `MobileAdsInitProvider` は `exported=false`。manifest merger reportによるとAdServices権限はGoogle Mobile Ads 25.4.0由来、`FOREGROUND_SERVICE` は `androidx.work:work-runtime:2.7.0` 由来、`WAKE_LOCK` はGoogle measurement SDK API 20.1.2とWorkManager由来。公開用bundleで必要性を再確認する。
- AABは約223 MB。Store提出前にPlay Consoleの実際の配信サイズ判定と不要assetsの有無を確認。今回サイズ削減のための資産削除は行わない。

生成AABや署名鍵をcommitしない。既存WindowsローカルGradle差分2件とstashは保持する。
