# iOS無料QA手順（Mac/Xcodeで実施）

WindowsではXcode/iOS Simulatorを実行できないため、このチェックは**未実施**。Apple Developer Programへの有料加入やApp Store Connectへの提出なしで、Mac側の同じ `online-beta` を使って実施する。既存のiOS設定・StoreKit・Worker接続先を勝手に変更しない。

## 準備とビルド

1. `git branch --show-current`、`git rev-parse HEAD`、`git status` で基準を確認。未commit差分を保護。
2. rootの最新Web資産と `www` をプロジェクト既定手順で照合し、必要な場合だけ同期。その後 `npx cap sync ios`。`www` を手作業で組み直さない。
3. `xcodebuild -list -project ios/App/App.xcodeproj` でschemeを確認。
4. 例：`xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`。ローカル環境のXcode/Swift Package設定に応じて修正し、Simulatorへ起動。Store配布用署名やArchiveはこの段階で不要。

## 画面・機能

- [ ] Home、猫/警察CPU、Collection、オンライン入口、ランク、Pass、Skill Modeの基本表示。
- [ ] SettingsのPrivacy/Terms/Supportリンク、オンラインデータ削除の二段階確認。QAアカウント以外の実データを削除しない。
- [ ] StoreKit商品一覧・購入UI・復元UIの表示とエラー処理。実購入・購読は行わない。Simulatorで利用できないStore機能は「端末/Console待ち」と記録。
- [ ] Pass情報と星灯りSkinの所有/未所有表示。QA fixtureをProductionへ持ち込まない。
- [ ] オンラインプロフィール・外観・フレームの表示。相手端末が必要な対戦はSandbox QAとして別記録。

## 広告・プライバシー

- [ ] Google公式テスト広告IDだけを使用。`requestConsentInfo`、必要時の `showConsentForm`、`canRequestAds` 前の広告ロード禁止、privacy options導線を確認。
- [ ] iOS pluginのUMP debug geographyとtest device IDでEEA/US/Other、consent reset後の初回状態を確認。`resetConsentInfo()` はテスト端末のみ。message未設定ならConsole依存として記録。
- [ ] ATT promptの有無、`NSUserTrackingUsageDescription`、IDFA直接取得の有無を公開候補ビルドで確認。現行アプリ側ではATT明示呼び出しとInfo.plistの用途説明が見つからないが、SDK/Console挙動は実機で再確認。
- [ ] リワード広告のテスト表示を確認。test modeではSSVによる正式権利付与を前提にしない。Skill Mode 3回解放、スタミナ+1、日次上限は既存自動テストに加え、必要ならSandbox実機で検証。

## 記録

Xcode版、iOS Simulator機種/OS、build結果、Consoleログ、各画面PASS/FAIL、UMP地域ごとのstatus・canRequestAds・privacy options、ATT/IDFA結果を残す。スクリーンショットはStore提出用とは別に保管し、playerId・credential・購入tokenを公開しない。最終のApp Privacy/Tracking回答はAdMob Consoleと公開iOSビルド確認後に確定する。
