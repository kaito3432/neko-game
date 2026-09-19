# にゃんチェイス 開発コンテキスト

## プロジェクト概要

「にゃんチェイス」というスマホ向けゲームを開発中。

ゲーム内容：
- いたずらネコ 1匹
- 柴犬警察 3匹
- 5×5のダンボール盤面
- 全11ターン
- スマホ縦画面
- オンライン対戦対応
- CPU対戦対応

GitHubリポジトリ：
- kaito3432/neko-game

基本ブランチ：
- online-beta

Package / Bundle ID：
- jp.nyanchase.game


## 開発環境の役割分担

### Mac

主にiOS関連：
- Xcode
- iPhone Debug build
- StoreKit 2
- iOS AdMob
- iPhone実機インストール

### Windows

主にAndroid関連：
- Android Studio
- Android Debug build
- Google Play Billing
- Android AdMob
- Android Emulator / 実機

MacとWindowsで別プロジェクトを作らない。

両方とも同じGitHubリポジトリ
kaito3432/neko-game
の online-beta ブランチを使用する。

GitHub経由で同期する。


# 現在までの主要実装

## Phase 1

収益化の基盤を実装。

主な内容：
- monetization.js
- monetization-products.js
- monetization-ui.js
- MONETIZATION_SPEC.md
- Mock広告
- Mock購入
- localStorageによる所有状態


## Phase 2

スキル所有権・商品構成を実装。

無料スキル：
- CAT_STEALTH
  - 忍び足
- POLICE_HOWL
  - 遠吠え

有料スキル：
- CAT_FAKE_PAW
  - フェイク肉球
- POLICE_GROUP_SEARCH
  - 一斉捜索
- POLICE_DASH
  - ダッシュ

商品：
- SKILL_CAT_FAKE_PAW
- SKILL_POLICE_GROUP_SEARCH
- SKILL_POLICE_DASH
- SKILL_PACK_01
- REMOVE_ADS
- REMOVE_ADS_PLUS_SKILL_PACK_01

SKILL_PACK_01：
- CAT_FAKE_PAW
- POLICE_GROUP_SEARCH
- POLICE_DASH

1試合で使用できる特殊能力：
- 猫：1つだけ
- 警察：1つだけ


## Phase 3

オンライン対戦のサーバー側スキル検証を実装。

クライアントの所有権情報を信用しない。

サーバー側で：
- スキルID
- ロール
- スキルモード解放
- 所有権
- 1試合1スキル

を検証。

主なエラー：
- INVALID_SKILL_ID
- SKILL_ROLE_MISMATCH
- SKILL_MODE_LOCKED
- SKILL_NOT_OWNED
- MULTIPLE_SKILLS_NOT_ALLOWED
- SKILL_NOT_EQUIPPED


## Phase 4

広告3回によるスキルモード永久解放をサーバー側で検証。

仕様：
- リワード広告を3回見るとスキルモード永久解放
- 0/3
- 1/3
- 2/3
- 3/3 → unlocked

サーバー側で広告報酬を検証する。


## Phase 5

iOS AdMob Rewarded統合。

使用：
- @capacitor-community/admob
- Google Mobile Ads SDK
- Google UMP

広告表示後、SSVによるサーバー検証を行う。

Google公式テスト広告ではSSVが飛ばないため、
広告表示テストは可能だが、
サーバー側の正式な3回カウントは増えない。


## Phase 6

iOS StoreKit 2統合。

Native bridge：
- NyanStoreKitPlugin.swift

機能：
- 商品取得
- 購入
- Cancel
- Pending
- Restore
- Transaction.updates
- currentEntitlements

価格表示：
- StoreKitのdisplayPriceを使用
- 価格をJSにハードコードしない

購入後：
- Apple App Store Server APIでサーバー検証
- 正式確認後に所有権付与
- 同一transactionの二重付与防止

必要なWorker Secrets：
- APP_STORE_CONNECT_PRIVATE_KEY
- APP_STORE_CONNECT_KEY_ID
- APP_STORE_CONNECT_ISSUER_ID
- APPLE_BUNDLE_ID=jp.nyanchase.game

Apple Developer Programはまだ未加入。
正式Sandbox IAPテストは公開直前に行う予定。


## Phase 7

正式な収益化UIを実装。

内容：
- 広告進捗 0/3〜2/3
- スキルモード解放表示
- 6商品表示
- 購入済み
- Pack内所有
- 購入中
- 利用不可
- Restore
- Store公式価格表示
- 375x667など小画面対応


## Phase 8

Android対応を実装。

追加：
- android/
- google-play-provider.js
- purchase-provider.js
- server/google-play-verification.mjs
- ANDROID_MONETIZATION_SETUP.md
- scripts/build-android-debug.sh

Android機能：
- AdMob Rewarded
- Google Play Billing
- 商品取得
- 購入
- Pending
- Cancel
- Restore
- サーバー検証
- purchaseToken二重使用防止

Google Play Billing Library：
- 9.1.0

将来必要なWorker設定：
- GOOGLE_PLAY_PACKAGE_NAME
- GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY
- ADMOB_REWARDED_AD_UNIT_ID
- ADMOB_SKILL_MODE_REWARD_ITEM


# オンライン機能で既に修正済みの重要事項

## 相手プロフィールフレーム

- server profileのequippedProfileFrameIdを使用
- playerIdに紐付け
- 所有権検証
- 不正IDはdefault
- 試合切替時に前相手情報を消す

## 勝利紙吹雪

official winnerPlayerIdが自分のplayerIdと一致した場合のみ表示。

対応：
- 通常勝利
- 切断勝利
- timeout勝利

非表示：
- 敗北
- 開始前中止
- serverInvalid

## ランダム対戦→部屋対戦

前相手情報が残る不具合を修正済み。

## 結果画面

小画面では縦スクロール対応。


# 重要な開発ルール

1. 新しいプロジェクトを作らない
2. 既存のneko-gameを修正する
3. online-betaを基準にする
4. 既存設計を確認してから変更する
5. 勝手に大規模リファクタリングしない
6. iOSの既存機能を壊さない
7. Android対応でiOSコードを壊さない
8. Web版を壊さない
9. 本番Workerへ勝手にデプロイしない
10. Google Playへ勝手に公開しない
11. App Store Connectへ勝手に公開しない
12. GitHubへ勝手にpushしない
13. ユーザーの許可なしにproductionへ反映しない
14. 実機での最終確認はユーザーが行う
15. 画像生成は行わない


# テスト方針

変更後は可能な範囲で：

- JS syntax check
- npm tests
- server tests
- git diff --check
- Android Gradle build
- iOS既存テストを壊していないか確認

を行う。

Phase 8時点で既存自動テストは約251件成功済み。


# 現在のWindows作業状況

Windows作業フォルダ：

C:\Users\honda\GitHub\neko-game

現在ブランチ：
- online-beta

Git：
- Git for Windows導入済み

Node.js：
- v24.21.0

npm：
- 11.19.0

PowerShellではnpm.ps1がExecution Policyで止まるため、
現在は以下を使用：

- npm.cmd
- npx.cmd

npm install済み。

Android Studio導入済み。

Android StudioのGradle JVM：
- JVM 21を使用する設定

ターミナル側ではJAVA_HOME設定が完全には整理されていない。

現在PowerShellで確認したjava -versionは：
- OpenJDK 25.0.3

Gradle側との互換性も確認すること。


# 現在のAndroidビルドで止まっている場所

最初のGradleビルド：

.\gradlew.bat assembleDebug

で以下のエラー：

capacitor-cordova-android-plugins/cordova.variables.gradle
が存在しない。

そのため：

npm.cmd install
npx.cmd cap sync android

を実行した。

npm installは成功。

しかし現在：

Could not find the web assets directory: .\www

で停止。

capacitor.config.json：

{
  "appId": "jp.nyanchase.game",
  "appName": "にゃんチェイス",
  "webDir": "www"
}

現状、Windows側に正しい www が生成されていない。

次の作業は、
既存プロジェクト内のMac/iOS側で使っていたWeb資産同期方法、
scripts、
iOS側のwww生成方法、
Androidビルド用スクリプト
を確認すること。

新しいビルド方式を勝手に作らない。

空のwwwフォルダを作るだけでは不可。

wwwには実際の：
- index.html
- JS
- CSS
- assets

などのWeb資産が必要。


# 次に実施する作業

まず既存コードを調査して、
正しいwww生成・同期方法を特定する。

その後：

1. wwwを正しく生成
2. npx.cmd cap sync android
3. Android Gradle Sync / Build
4. Android Debug APK生成

まで進める。

想定APK：

android/app/build/outputs/apk/debug/app-debug.apk


# Android作業で特に注意

Android Studioから新規Android Projectを作成しない。

現在GitHubに存在する：
- android/
- Capacitor構成
- Google Play Billing構成
- AdMob構成

をそのまま使用する。

既存のAndroid設計を調査してから修正すること。


# リリースについて

現在は開発・Debug段階。

まだ：
- Google Play公開しない
- App Store公開しない
- 本番課金を有効化しない

Apple Developer Program加入は公開直前予定。

Google Play Console側の正式商品設定も、
必要な段階で行う。


# Codexへの基本姿勢

不明な点がある場合は、
推測で新しい仕組みを作る前に既存コードを調査する。

特に：
- scripts/
- package.json
- capacitor.config.json
- ios/
- android/
- server/
- tests/
- README類
- monetization関連ファイル

を確認すること。

変更前に既存実装を理解し、
最小限の変更で対応する。
