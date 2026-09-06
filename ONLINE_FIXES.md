# オンライン実機指摘への修正（2026-09-06）

## 表示の対応付け

旧クライアントはsnapshot内のplayerIdを照合せず、役割別skinIdを直接表示していた。また新規接続時のsnapshot初期化と、切断済みWebSocketの遅延コールバック排除が不足していた。これらは誤表示の原因になり得るコード上の欠陥であり、実機症状の全経路を再現できたという意味ではない。サーバーのhost/guestからcat/policeへの割当自体には誤りを確認していない。

`online-appearance.js`でサーバーrole通知のplayerId、参加者ID、snapshot各役割のIDを照合する。自分の装備は参加時に取得したサーバープロフィールのID・所持・装備とも照合し、不一致はdefault。相手は自分の所持配列を参照しない。snapshotはコピーして試合単位に固定する。

`online.js`は新規部屋作成・参加・resetで表示状態を破棄し、以前のソケットの通知を無視する。表示変更イベントで選択中の相手柴犬と一時演出も破棄する。新しいメタデータを持たない旧サーバーの通知は安全側のdefaultになるため、新クライアント公開前にWorker更新が必要。

## ルール・待機・柴犬選択

- ランダムマッチでも既存の通常／特殊ルール選択UIを使う。ホストだけが選択でき、ready後は変更不可。再通知で選択画面を再度開かない。
- サーバーは既存engineに基づいて特殊ルールのイベントも検証する。CPU・engine・ターン数・勝敗条件は変更しない。
- 初期配置中と相手ターン中の待機理由を表示する。
- 警察の選択はdogIndexだけを相手へ中継する。猫からの選択通知・余分なtargetなどは受け付けない。操作完了／解除で選択表示を消す。

## 変更範囲と公開

クライアント：online-appearance.js、online.js、skin-presentation.js、game.js、index.html、service-worker.js。
サーバー：server/worker.mjs、server/session-events.mjs、server/random-game-validation.mjs。
テスト：tests/online-appearance.test.js、tests/online-foundation.test.js、tests/backend-online.cjs、tests/browser-online.cjs。
配信用wwwとiOS publicへクライアントファイルを同期。端末へのインストール、本番デプロイは未実施。binding、Worker名、namespace、migration設定は今回変更していない。

## 確認と残件

Node自動テスト107件成功。ローカルWorkerで部屋・ランダム対戦、捕獲・11ターン逃走、結果検証を確認。隔離Chrome二者テストでスキン・移動／発見演出・snapshot固定・デイリーの回帰確認を実施。所有者が異なるケースとID不一致、前試合からの表示切替はユニットテストで確認。

実機再確認は未実施。特殊ルールの全スキル組合せをChromeで完走したわけではない。公開後は両側クライアントを更新した上で、A未所持/B所持を役割交換し、次の試合をdefaultで開始する確認が必要。
