# Store申告・掲載素材の入力候補（Console未入力）

基準：`online-beta` / `c394bfef7f95afc8c1b3a4fc224ce056af3575f0`。これは実装から作る入力下書き。実機・公開SDK・Consoleの質問文が異なる場合はその場で再判定し、未確認項目を勝手に確定しない。法務根拠は `APP_PRIVACY_DISCLOSURE.md`。

## Google Play：対象年齢・IARC

- 対象年齢の暫定候補：**16～17歳と18歳以上**。18歳以上だけには決めない。子ども専用・Families向けには設計していない。猫・柴犬・丸いUI・ストア画像が13～15歳以下にも訴求し得るため、実際の素材と想定利用者をPlay Consoleで再確認。未成年を対象へ含める場合はFamilies・広告ポリシーを確認。対象年齢とIARCのcontent ratingは別の申告。

| IARC質問の種類 | 入力候補 | 根拠と最終確認 |
| --- | --- | --- |
| Cartoon / fantasy violence | 軽い追跡・捕獲表現を申告する候補 | 猫が3匹の柴犬から逃げる11ターン。傷害・攻撃描写かどうか実画面で強度・頻度を確認 |
| Realistic violence / blood / gore | いいえ候補 | 写実的な傷害・流血は実装で確認されない |
| Fear / horror | いいえ候補 | ホラー・強い恐怖演出は確認されない。効果音と画像を撮影時に再確認 |
| Sexual content / nudity | いいえ候補 | 該当表現は確認されない |
| Gambling / simulated gambling | いいえ候補 | 課金・コイン・Passはあるが、賭け金を置く賭博やカジノ模擬ではない。ランダムマッチと賭博を混同しない |
| Language / drugs / alcohol / tobacco | いいえ候補 | 罵倒表現、薬物、飲酒・喫煙描写は確認されない |
| Online interaction | はい | ランダムマッチと部屋対戦。対戦相手の限定profile/skin/frame/rankが見える |
| User communication / location sharing | いいえ候補 | 自由文チャット・音声チャット・位置共有なし。サーバー側displayName受入れと対戦表示は公開前に再監査 |
| Purchases / ads | はい | 買い切り、購読、リワード広告。広告内容は配信時に変わる |

## Google Play：Data Safety回答下書き

「収集」は端末外へ送る場合。「共有」はGoogleの第三者定義で確認し、契約上のservice provider処理を機械的に共有扱いしない。以下の必須/任意は**アプリ全体ではCPU戦が使える**ことと、当該機能内で必須であることを分けて記した。SDKによる初期化時送信は公開AABで再確認。通信暗号化・削除回答は公開ビルドと運用で確認する。

| データ型候補 | 収集 | 共有候補 | 必須/任意 | 一時処理 | 目的・根拠 |
| --- | --- | --- | --- | --- | --- |
| User IDs | オンライン利用時Yes | Cloudflareがservice providerのみならNo候補。対戦相手への表示を別途確認 | オンライン内では必須、CPUのみなら任意 | No | 匿名 `op_...` playerId、認証用credentialのサーバー照合ハッシュ。アカウント管理、認証、対戦、不正防止 |
| App activity / Other actions（game progress） | オンライン時Yes | service provider・相手への表示範囲を確認 | オンライン内では必須 | No | rank/RP/stats、mission、ownership、match result、stamina、coin。ゲーム機能、報酬、不正防止 |
| Purchase history | 購入・復元・失効時Yes | Store検証・Cloudflareの役割を確認 | 購入機能内では必須 | No | product ID、transaction/order identity、subscription period/state、refund/revoke。権利検証、復元、不正防止。カード番号は直接取得しない |
| Device or other IDs | AdMob SDK経由Yes候補 | Google広告サービスへの送信と役割を確認 | 広告利用時。初期化時送信も確認 | SDK仕様確認 | Android Releaseには `AD_ID`、`ACCESS_ADSERVICES_AD_ID`。アプリ自身の直接読取なし。広告、測定、不正防止 |
| App interactions / Advertising activity | AdMob SDK経由Yes候補 | Google広告サービスの区分を確認 | 広告利用時 | SDK仕様確認 | リワード広告表示・操作・測定。公開SDKと同意結果を確認 |
| Diagnostics | SDKまたはインフラ処理Yes候補 | 提供者の役割を確認 | SDK動作時 | SDK仕様確認 | エラー・性能・セキュリティ。AdMobとCloudflareの実処理範囲を確認 |
| IP address / Approximate location | 通信IPの処理あり、位置データ型は利用目的確認 | Cloudflare/Googleの役割を確認 | オンライン通信・広告時 | 保存・利用を確認 | 通信、セキュリティ、広告。IPから概略位置推定を行うか確認 |
| Email address | サポートメール利用時Yes | メール提供者の役割を確認 | 任意 | No | 問い合わせと外部削除依頼への対応。通常アカウント登録には使用しない |

公開済み候補URL：Privacy `https://kaito3432.github.io/neko-game/privacy.html`、削除 `https://kaito3432.github.io/neko-game/data-deletion.html`。外部削除は本人確認を要し、購入記録の保持例外がある。Data Safetyフォームのdata deletion/retention回答もこれに合わせる。

## Apple：Age Rating・App Privacy

| Apple Age Rating質問 | 回答候補 | 根拠 |
| --- | --- | --- |
| Cartoon/Fantasy violence | 実画面の追跡・捕獲に応じて「なし」または軽度 | 傷害表現の有無・頻度を実画面で確認 |
| Realistic violence、blood、horror、sexual content、nudity、gambling、substances | いいえ候補 | 現行ゲーム画面・ルールに該当実装なし |
| Multiplayer / online interaction | はい | ランダム・部屋対戦 |
| Social Media | いいえ候補 | 公開feed、投稿の再配布・拡散・like/commentがない |
| User-Generated Content | いいえ候補 | 自由文・画像・音声の広範な投稿なし。serverのdisplayName受入れは再監査 |
| Messaging / voice | いいえ候補 | 自由チャット・音声チャットなし |
| Advertising / In-App Purchases | はい | リワード広告、買い切り、購読 |

Appleの最終ratingは質問票から生成されるため年齢数値を先に固定しない。

| Apple App Privacyデータ型候補 | 収集 | Userに紐付くか | Tracking | 目的 |
| --- | --- | --- | --- | --- |
| User ID | Yes | Yes候補 | オンライン機能自体はNo、広告連携は確認待ち | 認証、対戦、不正防止 |
| Gameplay Content / Other User Content | Yes | Yes候補 | No候補 | 進行、ランク、プロフィール、報酬 |
| Purchase History | 購入時Yes | Yes候補 | No候補 | Store検証、復元、返金・失効 |
| Product Interaction / Advertising Data | SDK処理を確認 | SDK識別子との結合を確認 | 未確定 | 広告、測定、報酬検証 |
| Device ID / Diagnostics | SDK処理を確認 | SDKとplayerIdの結合を確認 | 未確定 | 広告、セキュリティ、診断 |
| IP address | 通信・SDKで処理され得る | Appleの適切なdata typeに割当 | 未確定 | 通信、広告、セキュリティ |
| Contact Info（メール） | サポート利用時Yes | 問い合わせに紐付く | No候補 | 問い合わせ・削除依頼 |

**Tracking=Noは条件付き候補**。アプリにATTの明示要求、IDFA直接取得、独自user-level ad profiling、data broker連携は見つからない。一方、AdMob Consoleのpersonalization/IDFA messageと公開iOS実機のSDK通信・同意別挙動が未確認。第三者データと広告目的で結合・共有するならApple定義に従って回答を変える。

## AdMob Consoleで確認する項目

- GDPR message、US state regulations message、Privacy options表示と同意撤回。
- ad personalization、IDFA message、child-directed treatment、under-age-of-consent treatment。年齢タグを根拠なくtrueへ固定しない。
- production App ID/ad units、app readiness、テスト端末と本番広告の分離。現在のAndroid Release AABはGoogle公式**テストApp ID**、Web設定もtest inventory。
- iOS実機でATT prompt/IDFA/UMP、Android実機でEEA・US・Otherの初回同意状態とrewarded load開始順を確認。テスト用debug geography/resetをProductionへ持ち込まない。

## Store掲載文案（公開前に文字数・表現をConsoleで調整）

- アプリ名：**にゃんチェイス**
- カテゴリ候補：Games / Strategy（実際の分類選択肢に合わせる）
- Google short description案：**いたずらネコと柴犬警察の、11ターンの追いかけっこ対戦ゲーム。**
- Google full description案：**5×5のダンボール盤面で、いたずらネコ1匹と柴犬警察3匹が11ターンの勝負。猫として逃げるか、警察として探すかを選び、CPU戦やオンライン対戦を楽しめます。コレクションで見た目を選び、ランク戦に挑戦できます。アプリ内購入、購読、任意のリワード広告があります。オンライン機能にはネット接続が必要です。**
- Apple subtitle案：**ネコと柴犬の11ターン対戦**
- Apple promotional text案：**5×5の盤面で、逃げるネコと追う柴犬の読み合いを楽しもう。**
- Apple description案：Google full description案を基礎に、Storeで確認した機能・価格・購読条件を追記。未設定の本番広告や未審査商品を利用可能と断定しない。
- Apple keywords候補：`猫,柴犬,対戦,戦略,追いかけっこ,ボードゲーム`（文字数・重複をConsoleで調整）。
- Support `https://kaito3432.github.io/neko-game/support.html`、Privacy `https://kaito3432.github.io/neko-game/privacy.html`、Terms `https://kaito3432.github.io/neko-game/terms.html`、Deletion `https://kaito3432.github.io/neko-game/data-deletion.html`。

### スクリーンショット撮影計画

Home、猫側盤面、警察側盤面、オンライン入口、ランク/スタミナ、Collection、Passの7場面。実際の公開候補buildから撮り、個人識別子・テスト同意画面・テスト広告・仮価格を写さない。各Storeのサイズ、枚数、端末種別はConsoleの最新要件を確認してから書き出す。

## PRODUCTION_SECRETS_CHECKLIST（値は記載しない）

- Apple：App Store Connect issuer ID、key ID、private key、Bundle ID、正式Product ID・subscription group/period、通知署名検証設定。
- Google：Play service account email/private key、package name、Product ID、subscription/base plan、Pub/Sub/RTDN検証設定。
- AdMob：公開App ID、Rewarded ad unit、SSV verifierまたは検証先、同意メッセージ設定。
- Cloudflare Production：`ONLINE_PLAYERS` / `GAME_ROOMS` binding維持、`MASTER_REWARD_PERIODS` 等の必要vars、Store/SSV secretsの有無と名前だけを確認。値・token・keystoreを文書やGitへ保存しない。

## Consoleアクセス後にのみ確定する事項

対象年齢/IARC、Data Safetyの公開SDK申告、Apple Age Rating/App Privacy、AdMob本番設定、正式広告・商品・購読、Store掲載の文字数/画像寸法、署名済み提出bundle、審査結果。`scripts/check-legal-release.cjs` のStore PENDINGを確認記録なしで消さない。

公式資料：[Play対象年齢](https://support.google.com/googleplay/android-developer/answer/9867159)、[Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)、[Apple Age Rating](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)、[Apple App Privacy](https://developer.apple.com/go/?id=info-1)、[Google UMP](https://developers.google.com/admob/android/privacy)、[Android App Signing](https://developer.android.com/studio/publish/app-signing)。
