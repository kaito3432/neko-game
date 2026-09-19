# AGENTS.md

このリポジトリはスマホゲーム「にゃんチェイス」です。

## 基本ルール

- 新規プロジェクトを作らない
- 既存リポジトリを修正する
- 基本ブランチは online-beta
- 既存アーキテクチャを優先する
- 大規模リファクタリングは禁止
- ユーザー指示の範囲外を勝手に変更しない

## プラットフォーム

Mac：
- iOS
- Xcode
- StoreKit
- iPhone build

Windows：
- Android
- Android Studio
- Google Play Billing
- Android build

両方とも同じGitHubリポジトリを使う。

## 変更時の注意

Android対応で以下を壊さない：
- iOS
- Web
- Online
- StoreKit
- AdMob
- Worker
- 既存テスト

iOS対応でAndroidを壊さない。

## デプロイ

明示的な指示がない限り：
- GitHubへpushしない
- production Workerへdeployしない
- Google Playへ公開しない
- App Storeへ公開しない

## 実機確認

Codexは：
- build
- install
- automated test

までは実施してよい。

最終的な実機UI・ゲームプレイ確認はユーザーが行う。

## Android

既存の android/ を使用する。

Android Studioで新規Projectを作らない。

Google Play Billing：
- Billing Library 9.1.0

Package：
- jp.nyanchase.game

## iOS

Bundle ID：
- jp.nyanchase.game

既存StoreKit 2実装を維持する。

## Monetization

無料スキル：
- CAT_STEALTH
- POLICE_HOWL

有料：
- CAT_FAKE_PAW
- POLICE_GROUP_SEARCH
- POLICE_DASH

PACK：
SKILL_PACK_01
- CAT_FAKE_PAW
- POLICE_GROUP_SEARCH
- POLICE_DASH

商品：
- SKILL_CAT_FAKE_PAW
- SKILL_POLICE_GROUP_SEARCH
- SKILL_POLICE_DASH
- SKILL_PACK_01
- REMOVE_ADS
- REMOVE_ADS_PLUS_SKILL_PACK_01

## スキルモード

リワード広告3回で永久解放。

オンラインではサーバー検証を必須とする。

client/localStorageの所有権申告を信用しない。

## 課金

iOS：
- StoreKit 2
- Apple Server verification

Android：
- Google Play Billing
- Google Play server verification

価格をハードコードしない。

Storeから取得した価格を使用する。

## テスト

変更後は可能な限り以下を確認：

- syntax
- tests
- git diff --check
- platform build

既存機能の破壊を避ける。

## 画像

ユーザーから明示的に依頼されていない限り、
画像生成・画像作り直しを行わない。

## 不明点

既存コードを確認せずに推測で実装しない。

まず：
- PROJECT_CONTEXT.md
- package.json
- capacitor.config.json
- scripts/
- android/
- ios/
- server/
- tests/

を確認する。
