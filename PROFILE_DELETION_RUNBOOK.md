# 外部オンラインプロフィール削除依頼：運営手順案

管理者用削除APIは実装済みだが、Productionでは未deploy・無効（`PROFILE_ADMIN_DELETE_ENABLED` と `PROFILE_ADMIN_DELETE_SECRET` は未設定）。`PROFILE_ADMIN_DELETE_ENABLED=true` と、Worker secret `PROFILE_ADMIN_DELETE_SECRET`（32文字以上の高エントロピーな英数字・`_`・`-` の値）の両方が必要。secretの実値はrepository、チケット、URL、コマンド引数へ保存しない。deployと専用QA profileによるlive QAが終わるまで「外部依頼を処理可能」と宣言しない。実ユーザーの削除は今回実施しない。

1. **受付**：`nyanchase@gmail.com` の「にゃんチェイス オンラインデータ削除依頼」を記録。アプリにアクセスできる人には、設定 → データとプライバシー → オンラインデータを削除を第一経路として案内する。アプリ内DELETEはBearer認証と二段階確認を使う。
2. **最小情報**：OS、おおよその利用時期、分かればplayerId、覚えているランク・使用キャラクター・Skin/Frame等を依頼。**playerIdだけで本人と判断しない**。Bearer credential、Apple signed transaction/JWS全文、Google purchase token全文、パスワード、カード番号を要求しない。購入識別子も初回は要求しない。
3. **サーバー照合**：権限を持つ担当者が限定的なプロフィール情報を参照し、依頼者の複数の独立した申告と照合。問い合わせメールの差出人だけで同一人物とみなさない。アクセス・照合結果は最小限の監査記録に残し、秘密値をコピーしない。
4. **判断**：合理的に確認できなければ誤削除防止のため保留し、追加の非秘密情報を求めるか削除不能を説明。プロフィールが見つからない場合も、他人のプロフィールを推定して削除しない。対戦・マッチング中は終了後に再確認。
5. **preview**：本人確認済みplayerIdに対して `POST /api/admin/profile-deletion/preview`。管理者Bearer secretと `X-Nyan-Admin-Actor` が必要。JSON本文は `playerId`、内部チケット番号 `supportReference`、固定enum `reason`（`external_verified_request` / `privacy_request` / `support_correction`）。応答のrank・RP・装備・購入保持件数と依頼内容を二重照合する。previewでは削除しない。`requestId` と `confirmationToken` は5分間有効で、チケットやログへ転記しない。Web UIから呼ばず、ブラウザOriginとCORSを使わない。対象一覧検索APIはない。
6. **execute**：対象playerId、削除範囲、購入保持記録、未完了の返金・dispute、担当者権限を再確認。`POST /api/admin/profile-deletion/execute` に同じ `playerId`、`supportReference`、`reason`、`requestId`、`confirmationToken`、`confirm:true`、再入力した `confirmPlayerId` を送る。preview後に状態が変わった場合や対戦・待機中は拒否される。実行試行でtokenは失効し、再試行には新規previewが必要。10分あたり接続元IPの認証試行60回、担当者のpreview 20回、execute 5回の制限がある。
7. **実行と検証**：既存の `deleteOnlineProfile` を再利用。transaction失敗時はrollbackする。プロフィール・キュー・Rank・Coin・Stamina・通常所有権等を削除し、購入復元・失効・不正防止と取得済み恒久Pass Skinに必要な最小記録を残す。過去Room/Matchやインフラログは別保持。削除後はプロフィール取得不可、再作成時は新しい匿名IDになることを確認する。Apple/Google購読解約・返金は行わない。
8. **post-check／通知**：監査結果と保持記録を確認。完了前に「完了」と通知しない。返信にはオンラインプロフィール削除完了、Rank/Coin等は復元不可、購入復元の最小記録が残る場合あり、購読解約・返金は別操作と記載する。
9. **incident handling**：対象誤認・権限外アクセス・削除失敗が疑われる場合は追加削除を停止、監査と保持記録を確認、担当者へエスカレーション。ユーザーへ確認済みの事実のみ説明し、復元可能・不可の範囲を確認する。秘密値をメールに再送しない。

監査にはrequest id、ハッシュ化した担当者識別子、対象playerId、preview/execute時刻、結果・失敗分類、保持件数、内部チケット番号、reasonのみを記録する。監査保持期間は今回固定せず、自動削除しない。後続のSandbox QAでは専用fixture profileで誤secret、誤対象、期限切れ、対戦中、成功、二重実行、購入・Pass Skin保持を確認する。Production secret設定、deploy、live QAは後工程。

公開案内：`https://kaito3432.github.io/neko-game/data-deletion.html`。保留・保持方針は `APP_PRIVACY_DISCLOSURE.md` と一致させる。
