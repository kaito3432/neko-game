# にゃんチェイス ストア申告作業資料（公開前ドラフト）

この表は `online-beta` の実装と同梱文書を照合するための作業資料です。App Store Connect／Google Play Consoleへそのまま転記する確定回答ではありません。第三者SDK・広告設定、対象年齢、提供地域、運営体制を公開前に確認してください。

## 公開前に確定する情報

- 運営者：にゃんチェイス運営
- 所在地：日本
- 問い合わせ：nyanchase@gmail.com
- 公開Web URL：https://kaito3432.github.io/neko-game/
- Store申告用URL候補：Privacy Policy https://kaito3432.github.io/neko-game/privacy.html ／ Support https://kaito3432.github.io/neko-game/support.html ／ Data deletion https://kaito3432.github.io/neko-game/data-deletion.html ／ Terms https://kaito3432.github.io/neko-game/terms.html
- 施行日：2026年10月7日
- 外部削除依頼の本人確認：アプリにアクセスできる場合はBearer認証済みのアプリ内削除を推奨。利用できない場合は `data-deletion.html` からサポートメールへ依頼し、OS・おおよその利用時期・分かればplayerId・覚えているランクや装備等、複数の情報をサーバー上のプロフィールと照合する。playerIdのみでは削除しない。秘密のcredentialやStore token全文は要求しない。合理的に確認できない場合は誤削除防止のため削除できないことがある。
- 子ども専用・子ども向けとして設計していない。Families Program向けに意図的に設計していない。Playの対象年齢層とApple Age Ratingは、下記の実装事実・ストア素材を照合してConsoleで確定する。
- AdMobの配信・同意・IDFAメッセージ設定とApple Tracking申告は、下記の確認条件を満たしてからConsoleで確定する。
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
- Android Debugのmerged manifestには `com.google.android.gms.permission.AD_ID` と `android.permission.ACCESS_ADSERVICES_AD_ID` が依存SDK経由で含まれる。Release bundleは公開前に別途確認する。Play Data safetyへ反映する。アプリ側で広告IDを直接読む処理は確認されない。
- パーソナライズ／非パーソナライズ／限定広告をアプリが明示的に指定する処理はない。実際の広告モードはUMP同意結果、AdMob Console設定、SDK側の挙動に依存するため、公開前に実機とConsoleで確認する。
- 独立したFirebase Analytics、Google Analytics、Crashlytics、Sentryは現行依存関係から確認されない。AdMob由来の測定とは区別する。
- アプリ内の認証済みDELETEはオンラインプロフィール本体を削除し、購入復元・失効・不正防止の最小記録は別に保持し得る。過去Room／Matchやインフラログの即時全消去を保証しない。
- `PURCHASE_REVOKE_RETENTION_DAYS`は未設定時に失効記録の自動cleanupを行わない。設定値365で失効記録の候補判定を行えるが、現行Workerのscheduled処理は購入記録cleanupを呼ばず、削除は自動実行されない。Production環境変数も今回変更しない。365日方針に沿った実際の削除手順・保留例外の運用は本番反映前に別途確認する。
- App StoreのAge Ratingは質問票へ実装事実どおり回答する。現状は自由チャット・SNS投稿・ユーザー自由文の投稿なし、オンラインPvP・リワード広告・アプリ内購入あり。最終区分はAppleの判定に従い、年齢の下限値を今は固定しない。

## 対象年齢とコンテンツ質問票の入力候補

| 項目 | 現行実装からの候補 | Consoleで確定する条件 |
| --- | --- | --- |
| Play対象年齢 | 子ども専用ではない。暫定候補は16～17歳と18歳以上。13～15歳への訴求も素材審査で確認。18歳以上のみは**保留** | 猫・柴犬、丸い絵柄、やさしいUI、ストア画像・説明が若年層にも訴求し得る。成人専用の内容ではないため、18+をFamilies要件回避のためだけに選ばない。実際の対象利用者・広告・課金・オンライン機能・ストア素材に整合する年齢帯を選ぶ。未成年を含めるなら該当するFamilies/広告上の追加要件を確認する |
| Play Content Rating / IARC | 追跡・捕獲のある軽い漫画表現、オンラインPvP、広告、IAP/Passあり | 暴力は実画面の捕獲表現に沿って「なし」または軽いcartoon/fantasyを判定。現行実装に写実的暴力、流血、恐怖演出、性的内容、賭博、薬物、罵倒表現は確認されない。質問票の地域別文言に合わせる |
| Apple Age Rating：violence / fear等 | 追跡・捕獲のみ。写実的暴力、ホラー、性的内容、賭博、薬物は「なし」候補 | cartoon/fantasy violenceは実画面で傷害表現があるか再確認。頻度・強度を過小申告しない。最終年齢区分はAppleの算定結果に従う |
| Apple Age Rating：user interaction | ランダム・部屋対戦、相手の限定的なprofile/skin/frame/rank表示あり。自由チャット、音声チャット、コメント、画像・動画投稿、SNS feedなし | multiplayer/user interactionの設問は「あり」。Social Mediaは投稿の広範な再配布・feed等がないため「なし」候補。UGC投稿も「なし」候補。自由入力の名前欄は現行UIで確認されないが、サーバーのdisplayName受入れと対戦表示は公開前に再監査する |
| Apple Age Rating：advertising / purchases | リワード広告、消耗品・買い切り・購読あり | 広告とアプリ内購入の設問は「あり」。外部リンクや購入誘導の文言も質問票に沿って確認する |

対象年齢はContent Ratingと別の申告です。18+を選んでも自動的にアプリ内年齢確認ゲートを追加するものではありません。逆に子どもを対象年齢へ含める場合はFamilies要件を再評価します。

## App Store App Privacy 回答案（要最終検証）

| Data type候補 | Collected | Linked to user | Tracking | Purpose | Notes / verification needed |
| --- | --- | --- | --- | --- | --- |
| User ID | はい | はい（匿名playerIdへの紐付け） | 現行オンライン用途ではいいえ | アプリ機能、対戦、認証、不正防止 | 広告SDKとのID連携有無を別途確認 |
| Gameplay content / Other user content | はい | はい | いいえ | ランク、戦績、プロフィール、所持品、対戦 | Appleの最終データ型への割当を確認 |
| Purchase history | はい | はい | いいえ | 権利検証、復元、返金・失効対応 | Store側情報の範囲を確認。カード番号は直接取得しない |
| Product Interaction / Advertising Data | AdMob SDKにより収集され得る | SDK設定と識別子連携を確認 | **未確定** | 広告配信、報酬検証、測定、不正防止 | 広告リクエスト、閲覧・クリック、同意結果とAdMob公開時設定を確認 |
| Device ID / IP address / Diagnostics | SDK・インフラにより処理され得る | playerId・SDK識別子との結合を確認 | **未確定** | 広告、セキュリティ、診断 | IPはAppleの独立データ型ではなく利用目的に応じた型へ割当。SDK privacy detailsを公開時の版で確認 |
| Contact information | 問い合わせ時のみ | 問い合わせ内容に紐付く | いいえ | サポート対応 | 実際の窓口運用を確定 |

Appleの回答はアプリと第三者SDKを含む実運用を対象にする。匿名IDもプロフィール・購入へ結び付くため、User ID、Gameplay Content、Purchase HistoryはLinked to User候補。問い合わせメールはContact Infoとして任意のサポート利用時に収集する。広告由来の識別子・利用状況・診断はSDKの実際の送信と結合を確認して行ごとに申告する。Tracking欄はATT／広告設定が確定するまで提出しない。

## Google Play Data safety 回答案（要最終検証）

| Data type候補 | Collected | Shared | Purpose | Required / optional | Ephemeral | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| User IDs | オンライン利用時にはい | Cloudflareが契約上のservice providerだけなら「共有しない」候補 | アカウント管理、ゲーム機能、不正防止 | CPU戦のみなら任意、オンライン機能内では必須 | いいえ | 匿名playerId。Bearer credentialは端末保存、サーバー照合用ハッシュはプロフィールに結合。対戦相手へ限定プロフィールを表示 |
| App activity / Game progress | オンライン利用時にはい | 同上。対戦相手への表示範囲を確認 | ゲーム機能、対戦、報酬 | オンライン機能内では必須 | いいえ | Rank、RP、stats、mission、ownership、match result、stamina、coin。ConsoleのApp activity/Other actions等へ実際の選択肢で割当 |
| Purchase history | 購入・復元・失効処理時にはい | Store検証とservice providerの区分を確認 | 購入権利、復元、不正防止 | 購入機能内では必須 | いいえ | product ID、transaction/order identity、subscription period/state、refund/revoke。カード番号は直接取得しない |
| App interactions / Device identifiers / Diagnostics | AdMob SDKで収集され得る | Google広告サービスへの送信とservice provider例外を確認 | 広告、測定、不正防止 | リワード広告機能利用時。SDK初期化時点も確認 | SDK処理を確認 | GMA Android 25.4.0、UMP 4.0.0。SDK公式Data safety記載と公開時版を照合 |
| IP address / approximate location | Cloudflare通信とAdMob SDKで処理され得る | 受領者の役割を確認 | 通信、セキュリティ、広告 | オンライン通信・広告利用時 | 要確認 | IPから概略位置を推定するか、SDKとインフラの使用目的を確認 |
| Email address | サポート依頼時のみ | 窓口サービスを確認 | 問い合わせ対応 | 任意 | いいえ | サポートメール確定後に確認 |

Googleの「Shared」は第三者への移転を指し、契約上のservice providerへの処理委託は定義上除外され得る。Cloudflareへの送信だけで機械的にShared=Yesとはしない。AdMob SDKのGoogleへの送信、相手プレイヤーへのプロフィール表示、各提供者の契約上の役割をConsole定義で最終判定する。オンライン・購入・広告利用時の保存データはephemeralと扱わない。Data deletion回答用URL候補は公開済みの `https://kaito3432.github.io/neko-game/data-deletion.html`。

## AdMob・識別子・Tracking監査とConsole確認待ち

- Android Debugのmerged manifestには `com.google.android.gms.permission.AD_ID` と `android.permission.ACCESS_ADSERVICES_AD_ID` が依存SDK由来で存在する。Releaseでも最終bundleのmerged manifestを確認する。前者は広告IDアクセス権限、後者はAndroidのAdServices広告ID API用権限であり、権限の存在だけではアプリ自身による読取やTracking確定を意味しない。アプリコードの直接読取は見つからないが、SDK経由のDevice ID収集候補として申告する。
- UMPは `requestConsentInfo()`、必要時 `showConsentForm()`、`canRequestAds` 確認を経て広告を準備する。設定からprivacy options再表示が可能。アプリはpersonalized / non-personalized / limited adsを固定していない。
- iOSはアプリコードによる `ATTrackingManager.requestTrackingAuthorization()` とIDFA直接読取を確認できず、`NSUserTrackingUsageDescription` もない。AdMob SDKはATT未許可時にIDFAを広告リクエストへ含めないという公式仕様。ただしIDFA不使用だけでAppleのTracking=Noは確定しない。SDKの他識別子・first-party ID、第三者データとの広告目的の結合、cross-app広告測定も確認する。
- **Tracking=Noは条件付き候補**：公開iOSビルドでATTが出ずIDFAを取得せず、AdMobの公開時設定・配信・測定がApple定義のcross-app trackingやdata broker提供に当たらず、独自のuser-level ad profilingもないと確認できた場合に限る。一つでも該当するなら実態に沿ってYes/ATT要否を再評価する。

### Store Console確認待ち（すべて未確認、申告保留）

- [ ] Play対象年齢帯とストア画像・説明の整合、Families適用要否、IARC質問票の実画面確認。
- [ ] Apple Age Rating質問票の入力と算定結果。multiplayer、広告、IAP、cartoon表現を実画面と照合。
- [ ] Play Data safetyの公開SDK版、SDK送信、service provider区分、各データ型と必須・任意の回答。
- [ ] Apple App Privacyの公開SDK privacy details、Linked to User、広告データと診断データの実際の送信。
- [ ] AdMob Privacy & messagingのGDPR/US州メッセージ、IDFA message、ad personalization controls。
- [ ] AdMobのchild-directed/under-age-of-consent treatment、公開ad unit、app readiness。
- [ ] iOS実機でのUMP同意別挙動、ATT表示、IDFA有無、広告・測定における第三者データ結合。Tracking回答はこの確認後。
- [ ] Android Release bundleの広告ID権限とSDK版、Android実機での同意別広告挙動。

Consoleへの入力・変更はまだ行わない。各項目を確認した証跡と日付を残してからチェックを付ける。

## 削除・復元・保持に関する回答メモ

- アプリ内：`設定 → データとプライバシー → オンラインデータを削除`。Bearer認証と二段階確認による主経路で、メール本人確認は不要。外部：アプリを利用できない人が `data-deletion.html` からサポートへ依頼する補助経路。複数情報を照合してから手動処理し、playerIdの申告だけでは削除しない。現行HTTP DELETEはBearer認証限定であり、外部Webページに未認証削除機能は置かない。
- 削除するのは通常のオンライン進行・プロフィール。端末のCPUローカル進行は対象外。アプリのアンインストールだけではサーバーデータは消えない。
- 購入復元、返金・失効、重複利用・不正防止、取得済みPass月間Skin復元に必要な最小記録は保持し得る。有効な買い切りSkill・Pack等の永続権利と取得済み永続Pass月間Skinは復元に必要な期間保持する。Storeで失効・返金・取消が確定した購入の記録は確定時点から原則365日とし、未完了の返金処理、Store dispute、法的請求、不正調査、法令上の義務がある場合のみ必要な範囲・期間に限って延長する。
- 削除後の新匿名プロフィールではユーザー操作によるStore再検証で、買い切りSkill／Pack、有効Pass、対象の取得済み月間Skinを復元できる場合がある。Rank、RP、Coin、Stamina、Daily、Mission、Gift、試合進行は復元しない。
- プロフィール削除はStoreの購読解約・返金を行わない。過去Room／Match記録およびインフラログは別の保持対象で、即時全消去とは説明しない。
- Play ConsoleのAccount deletion URL候補は公開済み `data-deletion.html` のHTTPS URL。サポート側の権限付き手動削除手順と本人確認運用が整うまでは最終申告しない。

## 公式確認資料

- [Apple App Store Connect：App privacy](https://developer.apple.com/help/app-store-connect/reference/app-privacy/)
- [Apple App Store Connect：Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Google Play：Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Google Mobile Ads SDK：Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Cloudflare Privacy Policy](https://www.cloudflare.com/policies/privacy/)
- [Cloudflare Workers Logs：Freeプランの保持期間](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Google Play：対象年齢とコンテンツ](https://support.google.com/googleplay/android-developer/answer/9867159)
- [Apple：Age Rating質問票](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [Apple：Age Ratingの定義](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions)
- [Google Play：Data safety申告](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Google Mobile Ads iOS：IDFA](https://developers.google.com/admob/ios/privacy/idfa)
