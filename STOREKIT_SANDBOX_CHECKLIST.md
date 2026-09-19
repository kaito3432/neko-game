# StoreKit Sandbox準備

## App Store Connect

アプリ `jp.nyanchase.game` に、すべて「非消耗型（Non-Consumable）」として登録する。
価格はアプリに記録せず、App Store Connectで設定する。参照名は運用上の名前であり、
プロダクトIDは次の文字列と完全一致させる。

| Product ID | 推奨参照名 | 付与する権利 |
| --- | --- | --- |
| `SKILL_CAT_FAKE_PAW` | フェイク肉球 | `CAT_FAKE_PAW` |
| `SKILL_POLICE_GROUP_SEARCH` | 一斉捜索 | `POLICE_GROUP_SEARCH` |
| `SKILL_POLICE_DASH` | ダッシュ | `POLICE_DASH` |
| `SKILL_PACK_01` | スキル3点パック01 | 上記3スキル |
| `REMOVE_ADS` | 広告削除 | 強制広告・インタースティシャル広告を無効化 |
| `REMOVE_ADS_PLUS_SKILL_PACK_01` | 広告削除＋スキル3点パック01 | 広告削除＋上記3スキル |

各商品で、少なくとも日本語の表示名・説明、価格帯、審査用スクリーンショットを設定する。
有料契約、税務、銀行口座の状態も確認する。Sandbox Apple Accountは通常のApple Accountと
分け、端末の「設定 > デベロッパ > Sandbox Apple Account」から利用する。

## App Store Server API / Worker

App Store Connectの「ユーザとアクセス > 統合 > App内課金」でApp Store Server APIキーを
作成する。秘密鍵ファイル自体はGitへ追加しない。Workerが使用する名前は以下で固定する。

- Secret `APP_STORE_CONNECT_PRIVATE_KEY`: ダウンロードした `.p8` のPEM全文
- Secret `APP_STORE_CONNECT_KEY_ID`: APIキーID
- Secret `APP_STORE_CONNECT_ISSUER_ID`: Issuer ID
- Variable/Secret `APPLE_BUNDLE_ID`: `jp.nyanchase.game`

Sandbox用Workerにも同じ名前で設定する。本番Workerへ反映する前は、アプリのAPI接続先を
Sandbox Workerへ向けた専用Debugビルドを使用すること。本番Worker、namespace、Durable
ObjectをSandbox試験データで共有しない。

## 実機Sandbox確認順

1. 商品一覧に6商品が表示され、価格がApp Storeのローカライズ価格になっている。
2. 単品スキルを購入し、サーバープロフィールへ対応スキルだけが付与される。
3. 購入シートをキャンセルし、権利が増えない。
4. Ask to Buy等で保留を作り、「購入承認待ち」となり、承認前に権利が増えない。
5. `SKILL_PACK_01`で3スキルが付与され、既存単品権利が重複しない。
6. `REMOVE_ADS`で強制広告だけが抑止され、任意リワード広告は利用できる。
7. セット商品で広告削除と3スキルが付与される。
8. アプリを完全終了・再起動し、サーバープロフィールから権利が復元される。
9. 「購入を復元」を実行し、`Transaction.currentEntitlements`の各取引がAppleで再検証される。
10. 同じtransactionIdの再送で二重付与されない。
11. 通信遮断または検証失敗時は取引をfinishせず、復旧後の`Transaction.updates`で再試行できる。

スキル購入だけではスキルモードを解放しない。広告3回による
`skillModeUnlocked`が未達なら、購入済みスキルも対戦では使用不可のままとする。

## 現在の制限

オンラインIDは匿名Bearer方式である。現在の復元は同じ認証済みオンラインプロフィールを
対象とする。新端末で別の匿名プロフィールが生成された場合に旧プロフィールへ安全に戻すには、
今後のアカウント復旧・ログイン基盤が必要。
