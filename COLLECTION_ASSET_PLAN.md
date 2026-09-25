# にゃんチェイス コレクション素材設計

調査日: 2026-09-24
対象: `online-beta` の現行 `collection-catalog.js` / `collection.js` / `skin-presentation.js` / `game.js`

## 1. 結論

新商品1点あたりの推奨新規画像数は次のとおり。ロック素材の要否はカテゴリではなく入手方法で決める。

### にゃんコイン購入系（購入前も通常画像を公開）

| カテゴリ | 基本機能に必要 | ホーム推し表示まで含む | 専用ロック画像 | 主な差分 |
|---|---:|---:|---:|---|
| ネコスキン | 7枚 | 9枚 | 0枚 | 未所持でも通常の一覧画像を表示 |
| 柴犬スキン | 9枚 | 11枚 | 0枚 | 赤・黒・白の盤面駒3枚が必要 |
| ダンボール | 1枚 | 1枚 | 0枚 | 一覧と盤面を同じ透過画像で兼用 |
| 肉球テーマ | 1枚 | 1枚 | 0枚 | 一覧と足跡を兼用。START画像は既存共通素材を維持 |
| 盤面テーマ | 1枚 | 1枚 | 0枚 | 背景本体を一覧・詳細プレビューでも縮小流用 |

### 条件解放系（解放まで見た目を隠す）

| カテゴリ | 基本機能に必要 | ホーム推し表示まで含む | 専用ロック画像 | 例 |
|---|---:|---:|---:|---|
| ネコスキン | 9枚 | 11枚 | 2枚 | 怪盗にゃん、マスター限定ネコ |
| 柴犬スキン | 11枚 | 13枚 | 2枚 | 探偵しば、マスター限定柴犬 |
| ダンボール | 2枚 | 2枚 | 1枚 | 将来のチャレンジ報酬など |
| 肉球テーマ | 2枚 | 2枚 | 1枚 | 将来の条件報酬など |
| 盤面テーマ | 2枚 | 2枚 | 1枚 | 将来の条件報酬など |

「基本機能」は、コレクション一覧・詳細、実プレイ、リザルト、プロフィール、スキン演出を指す。
キャラクターをホームの推し表示にも使う場合だけ、前景装飾とキャラクターの2レイヤーを追加する。

## 2. 現行スキンで実際に使われている構成

### 怪盗にゃん

| 現行フィールド / 用途 | 現行ファイル | 実際の利用 |
|---|---|---|
| `collectionImage` | `cat_kaitou_collection_cutout.png` | 一覧・詳細の解放画像 |
| `silhouetteImage` | `cat_kaitou_collection_locked.png` | 未所持の一覧・詳細 |
| `profileImage` | `cat_kaitou_profile.png` | 自分・相手のプロフィールアイコン |
| `lockedProfileImage` | `cat_kaitou_profile_locked.png` | 未所持詳細のプロフィールプレビュー |
| `pieceImage` | `cat_kaitou_piece.png` | 盤面上のネコ駒 |
| `resultWinImage` | `cat_kaitou_result_win.png` | 装備者側が勝利した結果 |
| `resultLoseImage` | `cat_kaitou_result_lose.png` | 装備者側が敗北した結果 |
| `moveEffect` | `cat_kaitou_effect_cards.png` | ネコ移動時。オンラインでは警察側へ秘密移動を表示しない |
| `foundFootprintEffect` | `cat_kaitou_effect_gem.png` | 足跡が発見された時 |
| `homeImage` | `cat_kaitou_home.png` | 現状はホーム表示可否の判定に使われ、描画本体には使われない |
| ホーム装飾レイヤー | `kaito-nyan-home-treasure.png` | ホーム推し表示の前景 |
| ホームキャラレイヤー | `kaito-nyan-home-character.png` | ホーム推し表示の動くキャラクター |

`cat_kaitou_collection.png` と旧ホームアニメーションフレームは現行の主要表示経路では参照されていないため、新商品用の必須素材には含めない。

### 探偵しば

| 現行フィールド / 用途 | 現行ファイル | 実際の利用 |
|---|---|---|
| `collectionImage` | `dog_detective_collection.png` | 一覧・詳細の解放画像（3匹セット） |
| `silhouetteImage` | `dog_detective_collection_locked.png` | 未所持の一覧・詳細 |
| `profileImage` | `dog_detective_profile.png` | 自分・相手のプロフィールアイコン（3匹セット） |
| `lockedProfileImage` | `dog_detective_profile_locked.png` | 未所持詳細のプロフィールプレビュー |
| `pieceImage.red` | `dog_detective_red_piece.png` | 赤柴の盤面駒 |
| `pieceImage.black` | `dog_detective_black_piece.png` | 黒柴の盤面駒 |
| `pieceImage.white` | `dog_detective_white_piece.png` | 白柴の盤面駒 |
| `cardImage` | 上記3枚を再利用 | 柴犬選択カード。専用カード画像は増やしていない |
| `resultWinImage` | `dog_detective_result_win.png` | 装備者側が勝利した結果 |
| `resultLoseImage` | `dog_detective_result_lose.png` | 装備者側が敗北した結果 |
| `moveEffect` | `dog_detective_effect_clue.png` | 柴犬移動時 |
| `foundFootprintEffect` | `dog_detective_effect_search.png` | 足跡発見時 |
| `homeImage` | `dog_detective_home.png` | 現状はホーム表示可否の判定に使われ、描画本体には使われない |
| ホーム装飾レイヤー | `detective-shiba-home-clues.png` | ホーム推し表示の前景 |
| ホームキャラレイヤー | `detective-shiba-home-character.png` | ホーム推し表示の動く3匹 |

柴犬は盤面上で赤・黒・白を別々に選択・移動するため、盤面駒は最低3枚必要。コレクション、プロフィール、リザルトは3匹セット画像1枚ずつでよい。

## 3. 新規素材の推奨一覧

以下の `{id}` はカタログのitem ID、`{variant}` はテーマ名を表す。

### 3.1 ネコスキン（1商品あたり）

| 用途 | 必要枚数 | 推奨ファイル名 | 既存流用可否 | 新規作成要否 | 備考 |
|---|---:|---|---|---|---|
| 一覧・詳細の解放画像 | 1 | `{id}_collection.png` | 同じ画像を一覧と詳細で流用可 | 必要 | 正方形の透過全身絵を推奨 |
| 未所持表示 | 条件系のみ1 | `{id}_collection_locked.png` | コイン商品は通常画像を表示 | 条件系は必要 | 条件達成まで隠す報酬だけ専用黒塗りシルエットを使う |
| 盤面駒 | 1 | `{id}_piece.png` | プロフィール画像との兼用は非推奨 | 必要 | 小サイズ・円形トリミング前提で視認性優先 |
| プロフィールアイコン | 1 | `{id}_profile.png` | 一覧画像の顔が十分大きければ兼用可能 | 原則必要 | ネコ・柴犬ともオンライン共有対象 |
| 未所持プロフィール | 条件系のみ1 | `{id}_profile_locked.png` | コイン商品は通常profile画像を表示、または購入前はプロフィール欄を隠す | 条件系は必要 | 解放画像のCSS黒塗りは使用しない |
| 勝利リザルト | 1 | `{id}_result_win.png` | 敗北画像との兼用不可 | 必要 | 横長。勝敗を即座に判別できる構図 |
| 敗北リザルト | 1 | `{id}_result_lose.png` | 勝利画像との兼用不可 | 必要 | 現行ロジックが勝敗別フィールドを明示参照 |
| 移動エフェクト | 1 | `{id}_effect_move.png` | 発見エフェクトと表現が同じなら兼用可 | 原則必要 | 透過PNG。秘密移動は相手警察へ表示されない |
| 発見時エフェクト | 1 | `{id}_effect_found.png` | 移動エフェクトとの兼用は可能 | 原則必要 | 足跡発見位置へ表示 |
| ホーム前景 | 1 | `{id}_home_decor.png` | 他用途との兼用は非推奨 | ホーム対応時のみ | 透過レイヤー |
| ホームキャラクター | 1 | `{id}_home_character.png` | 一覧画像との兼用は可能だが配置調整が難しい | ホーム対応時のみ | 透過レイヤー、タップ反応の対象 |

コイン購入系は基本7枚、ホーム対応時9枚。条件解放系は専用シルエット2枚を追加し、基本9枚、ホーム対応時11枚。

### 3.2 柴犬スキン（3匹セット、1商品あたり）

| 用途 | 必要枚数 | 推奨ファイル名 | 既存流用可否 | 新規作成要否 | 備考 |
|---|---:|---|---|---|---|
| 一覧・詳細の解放画像 | 1 | `{id}_collection.png` | 一覧と詳細で流用可 | 必要 | 3匹セットの構図 |
| 未所持表示 | 条件系のみ1 | `{id}_collection_locked.png` | コイン商品は通常画像を表示 | 条件系は必要 | 条件達成まで隠す報酬だけ専用シルエットを使用 |
| 赤柴の盤面駒 | 1 | `{id}_red_piece.png` | 赤柴の選択カードにも流用可 | 必要 | 個体識別色が分かること |
| 黒柴の盤面駒 | 1 | `{id}_black_piece.png` | 黒柴の選択カードにも流用可 | 必要 | 同上 |
| 白柴の盤面駒 | 1 | `{id}_white_piece.png` | 白柴の選択カードにも流用可 | 必要 | 同上 |
| プロフィールアイコン | 1 | `{id}_profile.png` | 一覧画像の顔が十分大きければ兼用可能 | 原則必要 | 3匹セットでよい |
| 未所持プロフィール | 条件系のみ1 | `{id}_profile_locked.png` | コイン商品は通常profile画像を表示、または購入前はプロフィール欄を隠す | 条件系は必要 | 解放画像のCSS黒塗りは使用しない |
| 勝利リザルト | 1 | `{id}_result_win.png` | 敗北画像との兼用不可 | 必要 | 3匹セットの横長構図 |
| 敗北リザルト | 1 | `{id}_result_lose.png` | 勝利画像との兼用不可 | 必要 | 勝敗を明確にするため別画像を維持 |
| 移動エフェクト | 1 | `{id}_effect_move.png` | 発見エフェクトと兼用可能 | 原則必要 | どの柴犬が移動しても共通1枚でよい |
| 発見時エフェクト | 1 | `{id}_effect_found.png` | 移動エフェクトと兼用可能 | 原則必要 | 3匹別には不要 |
| ホーム前景 | 1 | `{id}_home_decor.png` | 他用途との兼用は非推奨 | ホーム対応時のみ | 透過レイヤー |
| ホームキャラクター | 1 | `{id}_home_character.png` | 一覧との兼用は可能 | ホーム対応時のみ | 3匹セット1枚でよい |

コイン購入系は基本9枚、ホーム対応時11枚。条件解放系は専用シルエット2枚を追加し、基本11枚、ホーム対応時13枚。柴犬選択カードを高解像度で別構図にしたい場合のみ、任意で3枚追加する。

### 3.3 ダンボール（1商品あたり）

| 用途 | 必要枚数 | 推奨ファイル名 | 既存流用可否 | 新規作成要否 | 備考 |
|---|---:|---|---|---|---|
| 一覧・詳細・実盤面 | 1 | `cardboard_{variant}.png` | 3用途で同一画像を流用 | 必要 | 透過、正方形、縮小しても箱と分かること |
| 未所持表示 | 条件系のみ1 | `cardboard_{variant}_locked.png` | コイン商品は通常画像を表示 | 条件系は必要 | コイン商品は価格・購入ボタン・バッジで未所持を表現 |

盤面には同じ画像を25箱へ描画するため、実盤面専用の別画像は不要。

### 3.4 肉球テーマ（1商品あたり）

| 用途 | 必要枚数 | 推奨ファイル名 | 既存流用可否 | 新規作成要否 | 備考 |
|---|---:|---|---|---|---|
| 一覧・詳細・盤面の足跡 | 1 | `paw_{variant}.png` | 3用途で同一画像を流用 | 必要 | 透過、正方形。小さくても方向・形が判別できること |
| 未所持表示 | 条件系のみ1 | `paw_{variant}_locked.png` | コイン商品は通常画像を表示 | 条件系は必要 | コイン商品は見た目を隠さない |

初期位置の `start.png` は足跡テーマと別の意味を持つため、既存共通素材を維持する。通常足跡、公開済み足跡、結果の移動軌跡は同じテーマ画像を使う設計が適切。

### 3.5 盤面テーマ（1商品あたり）

| 用途 | 必要枚数 | 推奨ファイル名 | 既存流用可否 | 新規作成要否 | 備考 |
|---|---:|---|---|---|---|
| 一覧・詳細プレビュー・実盤面背景 | 1 | `board_{variant}.png` | 3用途で同一画像を流用 | 必要 | 縦横トリミングに耐える背景。中央に重要要素を置かない |
| 未所持表示 | 条件系のみ1 | `board_{variant}_locked.png` | コイン商品は通常背景を表示 | 条件系は必要 | コイン商品は見た目を隠さない |

専用サムネイルは原則不要。背景本体をCSSの `object-fit: cover` / `background-size: cover` でプレビュー表示する。

## 4. 入手方法別のロック表示

### 4.1 条件達成で解放するアイテム

対象例:

- 怪盗にゃん / 探偵しば
- ランク到達報酬
- マスター限定スキン
- その他、条件達成まで見た目を隠す報酬

これらは従来どおり `silhouetteImage` / `lockedProfileImage` に専用の黒塗り画像を登録する。解放画像をCSSで黒塗りする方式には変更しない。

### 4.2 にゃんコイン購入商品

対象例:

- コイン購入のネコ / 柴犬スキン
- ダンボール
- 肉球テーマ
- 盤面テーマ

購入前から通常の `collectionImage` / `preview` を表示する。専用ロック画像は作らず、未所持、価格、購入ボタン、鍵またはショップバッジで購入前状態を示す。

`collection.js` の `displayImage()` は次の分岐を使用する。

- `acquisitionType === "coins"`: 未所持でも通常プレビューを返す
- `achievement` / `masterRankReward` / 見た目を隠す報酬: 専用シルエットを返す
- `rankReward`: 報酬種類に応じて専用ロック画像または既存CSSフレームを表示

### 4.3 ランク報酬系

| 報酬種類 | 解放前 | 解放後 | 画像枚数 |
|---|---|---|---:|
| マスター限定ネコスキン | 専用collection/profileシルエット | 通常のスキン一式 | 条件系ネコと同じ（基本9枚） |
| マスター限定柴犬スキン | 専用collection/profileシルエット | 通常のスキン一式 | 条件系柴犬と同じ（基本11枚） |
| 画像ベースのプロフィールフレーム | 専用黒塗り/秘密プレビュー | 通常フレーム画像 | 1ランクにつき2枚 |
| 現行CSSプロフィールフレーム | CSSの未所持表示 | CSSの通常表示 | ラスター画像0枚 |

現行のシルバー〜マスターフレームは `materialStatus:"css"` であり、画像素材を使っていない。将来画像フレームへ置き換える場合だけ、通常版と専用ロック版を用意する。

## 5. 現行実装上の注意点

1. `cardboardId` / `pawId` / `boardThemeId` は、カタログの `cardboardImage` / `pawImage` / `boardImage` を通して盤面へ反映する。
2. 一覧・ゲーム盤面・結果軌跡は同じカタログ定義を参照し、不正ID・未所持ID・画像欠落時は既存デフォルト素材へ戻す。
3. ダンボール・肉球・盤面テーマはローカル限定で、相手画面へ同期しない現在仕様を維持する。
4. プロフィールキャラクターはネコと柴犬の両方を許可しているため、柴犬にも `profileImage` が必要。
5. 柴犬の盤面駒は赤・黒・白の3枚が必要だが、一覧・プロフィール・リザルト・エフェクトは3匹セットまたは共通画像1枚でよい。
6. 勝敗画像は `resultWinImage` / `resultLoseImage` を別々に解決している。勝ったか負けたかを即座に伝える目的からも2枚を維持する。
7. `moveEffect` と `foundFootprintEffect` は同じ透過素材を指定することも技術的には可能。ただし用途が異なるため、演出品質を優先する場合は2枚用意する。
8. ホーム推し表示は現在、カタログの `homeImage` だけでは動作せず、`skin-presentation.js` のレイヤー定義も必要。新スキン追加時にはデータ駆動化するか、ホーム対象外とするかを先に決める。
9. 画像形式は現行互換を優先してPNG/JPGで記載した。透過が必要な駒・エフェクト・箱・肉球・ホームレイヤーはPNG、横長リザルトや非透過背景は容量次第でJPEG/WebPも検討できるが、WebView・service workerの配信確認が必要。

## 6. 既存流用可能素材

| 素材 | 流用先 |
|---|---|
| `start.png` | 全肉球テーマの開始地点表示 |
| 新スキンのcollection画像 | 同一スキンの一覧と詳細表示 |
| 新スキンのprofile画像 | 自分・対戦相手・結果画面のプロフィール表示 |
| 柴犬3色piece画像 | 盤面駒と柴犬選択カード |
| 新ダンボール画像 | 一覧・詳細・25箱の盤面表示 |
| 新肉球画像 | 一覧・詳細・非公開/公開足跡・結果軌跡 |
| 新盤面背景 | 一覧・詳細プレビュー・実盤面背景 |
| コイン商品の解放画像 | 購入前の一覧・詳細にもそのまま表示 |

## 7. 入手方法別の必要素材まとめ

### にゃんコイン購入系

第1弾としてネコ、柴犬、ダンボール、肉球、盤面を各1点作る場合:

- 基本構成: 7 + 9 + 1 + 1 + 1 = **19枚**
- ネコ・柴犬のホーム推し対応込み: 9 + 11 + 1 + 1 + 1 = **23枚**
- 専用ロック画像: **0枚**

### 条件解放系

- ネコスキン1点: 基本9枚 / ホーム対応11枚（専用ロック2枚を含む）
- 柴犬スキン1点: 基本11枚 / ホーム対応13枚（専用ロック2枚を含む）
- その他の条件解放コスメ: 通常画像1枚 + 専用ロック画像1枚 = 2枚

### ランク報酬系

- マスター限定ネコ: 条件解放ネコと同じ
- マスター限定柴犬: 条件解放柴犬と同じ
- 現行CSSプロフィールフレーム: 新規画像0枚
- 将来の画像プロフィールフレーム: 各ランクにつき通常1枚 + 専用ロック1枚

素材制作前に、新キャラスキンをホーム推し表示へ対応させるかを決定する。ロック方針は入手方法で確定済みであり、コイン商品用の黒塗り画像は制作しない。

## 8. 第1弾コインスキン受け入れ仕様

忍者にゃんと侍しばは既存の第1弾コイン商品ID `cat_coin_01` / `dog_coin_01` を使用する。素材未配置中は `materialStatus:"pending"`、`assetStatus:"placeholder"` を維持し、`plannedAssets` は受け入れ予定パスの記録にだけ使用する。存在しない予定パスを `preview` 等の描画フィールドへ設定しない。

共通配置先は `assets/images/skins/ninja01/` とする。両商品とも `acquisitionType:"coins"` のため、専用ロック画像は作らない。本番素材受け入れ後は購入前から通常の一覧画像を公開する。

### 8.1 忍者にゃん（`cat_coin_01`）

デザイン基準: 黒・濃紺を基調に赤を差し色とし、忍者頭巾・忍者マスク・素早さとstealth感を表現する。移動は煙玉または残像、発見は煙と驚きの演出にする。

| カタログ受け入れ項目 | 推奨ファイル名 | 想定asset path | 必須 | 備考 |
|---|---|---|---|---|
| `collectionImage` / `preview` | `cat_ninja_collection.png` | `assets/images/skins/ninja01/cat_ninja_collection.png` | 必須 | 一覧・詳細で共用。購入前も公開 |
| `profileImage` | `cat_ninja_profile.png` | `assets/images/skins/ninja01/cat_ninja_profile.png` | 必須 | 自分・相手のプロフィール表示 |
| `pieceImage` | `cat_ninja_piece.png` | `assets/images/skins/ninja01/cat_ninja_piece.png` | 必須 | 盤面上のネコ駒 |
| `resultWinImage` | `cat_ninja_result_win.png` | `assets/images/skins/ninja01/cat_ninja_result_win.png` | 必須 | 勝利が明確な横長画像 |
| `resultLoseImage` | `cat_ninja_result_lose.png` | `assets/images/skins/ninja01/cat_ninja_result_lose.png` | 必須 | 敗北が明確な横長画像 |
| `moveEffect` | `cat_ninja_effect_smoke.png` | `assets/images/skins/ninja01/cat_ninja_effect_smoke.png` | 必須 | 透過PNG。煙玉・残像系 |
| `foundFootprintEffect` | `cat_ninja_effect_found.png` | `assets/images/skins/ninja01/cat_ninja_effect_found.png` | 必須 | 透過PNG。煙＋驚き |
| ホーム前景レイヤー | `cat_ninja_home_decor.png` | `assets/images/skins/ninja01/cat_ninja_home_decor.png` | ホーム対応時 | 透過PNG |
| ホームキャラレイヤー | `cat_ninja_home_character.png` | `assets/images/skins/ninja01/cat_ninja_home_character.png` | ホーム対応時 | 透過PNG |
| `homeImage` 判定素材 | `cat_ninja_home.png` | `assets/images/skins/ninja01/cat_ninja_home.png` | ホーム対応時 | 現行のホーム表示可否判定用 |

基本機能は7枚、既存方式のホーム推し表示まで含める場合は合計10枚。専用ロック画像は0枚。

### 8.2 侍しば（`dog_coin_01`）

デザイン基準: 藍・茶・白を基調に金または赤を差し色とし、赤柴・黒柴・白柴を統一した侍装束・兜風・ちょんまげ風で表現する。移動は斬撃線または土煙、発見は気迫または「！」演出にする。

| カタログ受け入れ項目 | 推奨ファイル名 | 想定asset path | 必須 | 備考 |
|---|---|---|---|---|
| `collectionImage` / `preview` | `dog_samurai_collection.png` | `assets/images/skins/ninja01/dog_samurai_collection.png` | 必須 | 3匹セット。一覧・詳細で共用、購入前も公開 |
| `profileImage` | `dog_samurai_profile.png` | `assets/images/skins/ninja01/dog_samurai_profile.png` | 必須 | 3匹セットで自分・相手へ表示 |
| `pieceImage.red` | `dog_samurai_red_piece.png` | `assets/images/skins/ninja01/dog_samurai_red_piece.png` | 必須 | 赤柴の盤面駒・選択カード兼用 |
| `pieceImage.black` | `dog_samurai_black_piece.png` | `assets/images/skins/ninja01/dog_samurai_black_piece.png` | 必須 | 黒柴の盤面駒・選択カード兼用 |
| `pieceImage.white` | `dog_samurai_white_piece.png` | `assets/images/skins/ninja01/dog_samurai_white_piece.png` | 必須 | 白柴の盤面駒・選択カード兼用 |
| `resultWinImage` | `dog_samurai_result_win.png` | `assets/images/skins/ninja01/dog_samurai_result_win.png` | 必須 | 3匹セットの勝利画像 |
| `resultLoseImage` | `dog_samurai_result_lose.png` | `assets/images/skins/ninja01/dog_samurai_result_lose.png` | 必須 | 3匹セットの敗北画像 |
| `moveEffect` | `dog_samurai_effect_slash.png` | `assets/images/skins/ninja01/dog_samurai_effect_slash.png` | 必須 | 透過PNG。斬撃線・土煙系 |
| `foundFootprintEffect` | `dog_samurai_effect_found.png` | `assets/images/skins/ninja01/dog_samurai_effect_found.png` | 必須 | 透過PNG。気迫・「！」系 |
| ホーム前景レイヤー | `dog_samurai_home_decor.png` | `assets/images/skins/ninja01/dog_samurai_home_decor.png` | ホーム対応時 | 透過PNG |
| ホームキャラレイヤー | `dog_samurai_home_character.png` | `assets/images/skins/ninja01/dog_samurai_home_character.png` | ホーム対応時 | 3匹セットの透過PNG |
| `homeImage` 判定素材 | `dog_samurai_home.png` | `assets/images/skins/ninja01/dog_samurai_home.png` | ホーム対応時 | 現行のホーム表示可否判定用 |

基本機能は9枚、既存方式のホーム推し表示まで含める場合は合計12枚。専用ロック画像は0枚。柴犬選択カードは3色の盤面駒を流用し、別素材を増やさない。

### 8.3 素材受け入れ時の有効化手順

1. 上記ファイルを `assets/images/skins/ninja01/` へ配置する。
2. 透過が必要な駒・エフェクト・ホームレイヤーのアルファチャンネルと余白を確認する。
3. `plannedAssets` の各値を対応する描画フィールドへ設定し、侍しばは同じ3色駒を `cardImage` にも割り当てる。
4. ホーム対応する場合は、既存ホームレイヤー解決にも前景・キャラクターの定義を追加する。
5. 全必須素材の読み込み、勝敗画像、プロフィール同期、盤面表示を確認してから `materialStatus` を有効状態へ変更し、`assetStatus:"placeholder"` を解除する。
6. service workerのキャッシュキーとプリキャッシュ対象を更新する。

一部素材だけ届いた段階では `materialStatus:"pending"` を解除しない。コイン商品のため、完成後も `silhouetteImage` / `lockedProfileImage` は追加しない。
