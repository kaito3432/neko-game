# iOS撮影用プレビュー

提出Archiveとは別のDevelopment署名・Debug構成で使用する。Release設定は変更しない。

1. `node scripts/prepare-web-assets.cjs`（`--release`なし）、`npx cap sync ios`でDebug用資産を同期する。
2. XcodeのRun構成をDebugにし、Run → Arguments → Environment Variablesへ `NYAN_SCREENSHOT_MODE=1` を追加する。共有Schemeへ保存・commitしない。
3. 起動後、画面下部の「撮影用（ローカル限定・権利変更なし）」を開く。
4. CPU／ローカル対戦でスキルモードと各スキルを選択できる。パネルの「詳細」は通常の商品説明、「演出固定」は静止カットインを表示する。固定演出は対戦開始前に使い、「演出を閉じる」で戻る。
5. 撮影が終わったら環境変数を削除してアプリを再起動する。「撮影モード終了」もローカル利用判定を元に戻すが、安全のため購入等の操作ガードは再起動まで残る。

購入済み表示は偽装しない。所持フラグ・広告進捗・購入履歴・Worker profileは撮影用データで書き換えない。オンライン、広告、購入、復元、データ削除の入口は撮影中に遮断する。通常起動時の既存profile取得などは変更しない。

Release資産生成は`debug/`と参照scriptを除去し、Release資産検証も`debug/`残存を拒否する。nativeの許可フラグは`#if DEBUG`内にしかなく、Releaseからは返らない。再度Release buildする際は既存の正式Release資産生成・検証手順を必ず行う。

起動時から非永続WebView領域を使用し、外部通信とnative HTTP／StoreKit／広告呼び出しを遮断する。同じアプリbundle内の画像・WAV等のGET／HEADは許可し、通常のローカル効果音を再生できる。通常の保存領域・購入データは読み書きしない。DailyとCollectionは一時領域の初期データ表示となる。Onlineは「Online Room画面（通信なし）」で入口だけ表示し、作成・参加はしない。

撮影時は「パネルを隠す」を使用し、3本指で画面をタップすると戻せる。カットイン固定は動作中の対戦ではなく停止中の画面で行う。

撮影用解放を利用した画像が実際の販売条件を誤認させないよう、最終スクリーンショットは人間が確認する。
