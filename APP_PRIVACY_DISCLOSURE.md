# にゃんチェイス ストア申告作業資料（公開前ドラフト）

この表は `online-beta` の実装と同梱文書を照合するための作業資料です。App Store Connect／Google Play Consoleへそのまま転記する確定回答ではありません。第三者SDK・広告設定、対象年齢、提供地域、運営体制を公開前に確認してください。

## 公開前に確定する情報

- 運営者：にゃんチェイス運営
- 所在地：日本
- 問い合わせ：nyanchase@gmail.com
- 公開Web URL：https://kaito3432.github.io/neko-game/
- Store申告用URL候補：Privacy Policy https://kaito3432.github.io/neko-game/privacy.html ／ Support https://kaito3432.github.io/neko-game/support.html ／ Data deletion https://kaito3432.github.io/neko-game/data-deletion.html ／ Terms https://kaito3432.github.io/neko-game/terms.html
- 施行日：[施行日]
- 外部削除依頼の本人確認：アプリにアクセスできる場合はBearer認証済みのアプリ内削除を推奨。利用できない場合は `data-deletion.html` からサポートメールへ依頼し、OS・おおよその利用時期・分かればplayerId・覚えているランクや装備等、複数の情報をサーバー上のプロフィールと照合する。playerIdのみでは削除しない。秘密のcredentialやStore token全文は要求しない。合理的に確認できない場合は誤削除防止のため削除できないことがある。
- 子ども専用・子ども向けとして設計していない。Google Play Families Program向けとして意図的に設計しておらず、child-directed appとして申告しない。Play Consoleの具体的な対象年齢層選択とApple Age Rating質問票の最終回答：TODO
- AdMobのパーソナライズ広告・IDFAメッセージ設定、iOS ATTの最終方針、Store申告：TODO（実装監査結果は下記）
- 現在のWorkers FreeプランのWorkers Logs保持期間：3日。Durable Objectsのゲームデータや別系統の通信・セキュリティログの保持期間とは区別する。
- Storeで失効・返金・取消が確定した購入の記録：確定時点から原則365日。有効な永続購入権利と取得済み永続Pass月間Skinは復元に必要な期間。未完了の返金処理、Store dispute、法的請求、不正調査、法令上の義務は必要な範囲・期間に限る例外。

## 実装から確認できる範囲

- 匿名オンラインプロフィールは `op_...` playerIdとBearer credentialで識別し、サーバーはcredentialのハッシュをプロフィール参照に利用する。メール・氏名による通常のアカウント登録はない。
- 端末は主にlocalStorageへローカル進行、所有・装備、オンラインcredentialと表示用キャッシュを保存する。
- Cloudflare Workers／Durable Objectsがプロフィール、対戦、ランク、スタミナ、コイン、Pass、購入検証等を扱う。対戦相手へは試合に必要なプロフィール・外観・ランク等を共有する。
- Apple／Google Playが決済を扱う。運営者はクレジットカード番号を直接受け取らない。商品・取引識別情報、購読期間、返金・失効状態等をStore検証・復元・不正防止のため扱う。
- Google AdMob SDKを使用する。SDKのIPアドレス、広告・端末識別子、操作・診断データの処理は公開時のSDK版と設定で再確認する。
- 現行コードの広告形式はSkill Modeとランク戦スタミナ回復のリワード広告。`@capacitor-community/admob` 8.1.0 を使用し、iOS podspecはGoogle Mobile Ads SDK 13.6.0、GoogleUserMessagingPlatform `~>3.1`、Android Gradle設定はGoogle Mobile Ads `25.4.+`、UMP `4.0.0` を指定する。2026-10-06のAndroid Debug依存解決ではGoogle Mobile Ads `25.4.0`、UMP `4.0.0`。
- アプリはUMPの `requestConsentInfo()` を行い、必要なら `showConsentForm()` を表示する。`canRequestAds` が真のときだけリワード広告の準備・表示に進む。同意画面が開けない、または状態を取得できない場合は広告を表示しない。プライバシーオプションが必要と返された場合、設定画面に再表示の導線を出す。
- 現行アプリコードはATTダイアログを明示的に要求せず、IDFAを直接読み取らない。iOSの `NSUserTrackingUsageDescription` も未設定。AdMob Console側のメッセージやSDKの実際のデータ処理と合わせて公開前にTracking申告を判断する。ATT未許可時にIDFAが広告リクエストへ含まれないことはGoogleのSDK仕様による。
- Android DebugとReleaseのmerged manifestには `com.google.android.gms.permission.AD_ID` と `android.permission.ACCESS_ADSERVICES_AD_ID` が依存SDK経由で含まれる。Play Data safetyへ反映する。アプリ側で広告IDを直接読む処理は確認されない。
- パーソナライズ／非パーソナライズ／限定広告をアプリが明示的に指定する処理はない。実際の広告モードはUMP同意結果、AdMob Console設定、SDK側の挙動に依存するため、公開前に実機とConsoleで確認する。
- 独立したFirebase Analytics、Google Analytics、Crashlytics、Sentryは現行依存関係から確認されない。AdMob由来の測定とは区別する。
- アプリ内の認証済みDELETEはオンラインプロフィール本体を削除し、購入復元・失効・不正防止の最小記録は別に保持し得る。過去Room／Matchやインフラログの即時全消去を保証しない。
- `PURCHASE_REVOKE_RETENTION_DAYS`は未設定時に失効記録の自動cleanupを行わない。設定値365で失効記録の候補判定を行えるが、現行Workerのscheduled処理は購入記録cleanupを呼ばず、削除は自動実行されない。Production環境変数も今回変更しない。365日方針に沿った実際の削除手順・保留例外の運用は本番反映前に別途確認する。
- App StoreのAge Ratingは質問票へ実装事実どおり回答する。現状は自由チャット・SNS投稿・ユーザー自由文の投稿なし、オンラインPvP・リワード広告・アプリ内購入あり。最終区分はAppleの判定に従い、年齢の下限値を今は固定しない。

## App Store App Privacy 回答案（要最終検証）

| Data type候補 | Collected | Linked to user | Tracking | Purpose | Notes / verification needed |
| --- | --- | --- | --- | --- | --- |
| User ID | はい | はい（匿名playerIdへの紐付け） | 現行オンライン用途ではいいえ | アプリ機能、対戦、認証、不正防止 | 広告SDKとのID連携有無を別途確認 |
| Gameplay content / Other user content | はい | はい | いいえ | ランク、戦績、プロフィール、所持品、対戦 | Appleの最終データ型への割当を確認 |
| Purchase history | はい | はい | いいえ | 権利検証、復元、返金・失効対応 | Store側情報の範囲を確認。カード番号は直接取得しない |
| Product interaction / Advertising data | AdMob SDKにより収集され得る | SDK設定を確認 | **未確定** | 広告配信、報酬検証、測定、不正防止 | ATT、IDFA、パーソナライズ広告設定を確認 |
| Device ID / IP address / Diagnostics | SDK・インフラにより処理され得る | **要確認** | **未確定** | 広告、セキュリティ、診断 | Google Mobile Ads SDKとCloudflareの実データ経路を確認 |
| Contact information | 問い合わせ時のみ | 問い合わせ内容に紐付く | いいえ | サポート対応 | 実際の窓口運用を確定 |

Appleの回答はアプリと第三者SDKを含む実運用を対象にする。匿名IDもプロフィールへ結び付くので「Linked to user」を安易に否定しない。Tracking欄はATT／広告設定が確定するまで提出しない。

## Google Play Data safety 回答案（要最終検証）

| Data type候補 | Collected | Shared | Purpose | Required / optional | Ephemeral | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| User IDs | オンライン利用時 | Cloudflareによる処理 | アカウント管理、ゲーム機能、不正防止 | オンライン利用には必要 | いいえ | 匿名playerId、credentialハッシュ |
| App activity / Game progress | オンライン利用時 | Cloudflareによる処理 | ゲーム機能、対戦、報酬 | オンライン利用には必要 | いいえ | Rank、RP、結果、所持、Mission等 |
| Purchase history | 購入・復元時 | Apple／Googleとの検証、Cloudflare処理 | 購入権利、復元、不正防止 | 購入時に必要 | いいえ | Storeの識別情報、期間、返金・失効状態 |
| App interactions / Device identifiers / Diagnostics | AdMob SDKで収集・共有され得る | Google広告サービス | 広告、測定、不正防止 | 広告表示時 | SDKによるため要確認 | SDK版、広告ID、同意設定、共有区分を確認 |
| IP address | CloudflareとAdMobで処理され得る | 両提供者の取扱いを確認 | 通信、セキュリティ、広告 | オンライン通信・広告時 | 要確認 | 一般位置推定の扱いを確認 |
| Email address | サポート依頼時のみ | 窓口サービスを確認 | 問い合わせ対応 | 任意 | いいえ | サポートメール確定後に確認 |

Googleの「Shared」はサービス提供者としての処理やSDK送信の区分をConsoleの定義に従い最終判定する。アプリ内削除と外部Web削除依頼の両方の導線を公開した後、Data deletion回答へURLを登録する。

## 削除・復元・保持に関する回答メモ

- アプリ内：`設定 → データとプライバシー → オンラインデータを削除`。Bearer認証と二段階確認による主経路で、メール本人確認は不要。外部：アプリを利用できない人が `data-deletion.html` からサポートへ依頼する補助経路。複数情報を照合してから手動処理し、playerIdの申告だけでは削除しない。現行HTTP DELETEはBearer認証限定であり、外部Webページに未認証削除機能は置かない。
- 削除するのは通常のオンライン進行・プロフィール。端末のCPUローカル進行は対象外。アプリのアンインストールだけではサーバーデータは消えない。
- 購入復元、返金・失効、重複利用・不正防止、取得済みPass月間Skin復元に必要な最小記録は保持し得る。有効な買い切りSkill・Pack等の永続権利と取得済み永続Pass月間Skinは復元に必要な期間保持する。Storeで失効・返金・取消が確定した購入の記録は確定時点から原則365日とし、未完了の返金処理、Store dispute、法的請求、不正調査、法令上の義務がある場合のみ必要な範囲・期間に限って延長する。
- 削除後の新匿名プロフィールではユーザー操作によるStore再検証で、買い切りSkill／Pack、有効Pass、対象の取得済み月間Skinを復元できる場合がある。Rank、RP、Coin、Stamina、Daily、Mission、Gift、試合進行は復元しない。
- プロフィール削除はStoreの購読解約・返金を行わない。過去Room／Match記録およびインフラログは別の保持対象で、即時全消去とは説明しない。
- Play ConsoleのAccount deletion URLには、公開後の `data-deletion.html` のHTTPS URLを登録する。公開URL・サポート側の権限付き手動削除手順と本人確認運用が整うまでは最終申告しない。

## 公式確認資料

- [Apple App Store Connect：App privacy](https://developer.apple.com/help/app-store-connect/reference/app-privacy/)
- [Apple App Store Connect：Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Google Play：Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Mobile Ads SDK：Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Cloudflare Privacy Policy](https://www.cloudflare.com/policies/privacy/)
- [Cloudflare Workers Logs：Freeプランの保持期間](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Google Play：対象年齢とコンテンツ](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Apple：Age Rating質問票](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
