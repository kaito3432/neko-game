# 購入失効記録365日方針：cleanup運用手順案

**現状：自動cleanupは有効ではない。** `server/purchase-lifecycle.mjs` の `cleanupPurchaseRecords(...,{dryRun:true})` は候補列挙を行えるが、`PURCHASE_REVOKE_RETENTION_DAYS` 未設定時は失効記録を自動候補にしない。現行Workerのscheduled処理はこのcleanupを呼ばない。本番環境変数やcronをこの文書に従って勝手に変更しない。

1. **適用対象確認**：Storeで失効・返金・取消が確定した記録について確定時点から原則365日。active entitlement、永続復元権利、未失効の取得済みPass月間Skinは除外。未完了の返金、Store dispute、法的請求、不正調査、法令義務は必要な範囲で保留。
2. **権限とスコープ**：対象Production Worker、Durable Object namespace、時刻基準、担当者、監査先を二重確認。Sandboxと取り違えない。秘密値や購入token全文をレポートに出さない。
3. **dry run**：正式運用前に、承認された安全な実行経路で `PURCHASE_REVOKE_RETENTION_DAYS=365` 相当を与えて候補数・最古/最新の失効日・除外理由を集計。必要な運用経路が未整備ならここで止める。データを削除しない。
4. **保留判断**：各候補のretentionClass、revokedAt、dispute/法的保留、復元必要性を確認。時刻欠落・分類不明は削除対象にしない。必要に応じて法務・サポート担当者へ照会。
5. **復旧準備**：操作前にCloudflareの利用可能なバックアップ/エクスポートと復旧手順、監査証跡を確認。復旧できない場合は実行しない。個人情報の複製は最小化し、安全な保管期限を設定。
6. **実行**：対象key数と保持例外を再確認し、承認された範囲だけ `dryRun:false` を実行。大量一括削除は避け、監査可能な小単位で進める。現行コードに管理者向け実行APIを新設する場合は別途設計・レビュー・テストが必要。
7. **事後確認**：削除件数、残ったactive/permanent entitlement、復元・返金通知の動作を検証。差異があれば停止し、復旧/インシデント手順へ移る。

この手順案はポリシー文言の運用準備であり、自動cleanup稼働や365日経過時の物理削除を保証しない。公開Privacy/Deletion文面との整合を維持する。
