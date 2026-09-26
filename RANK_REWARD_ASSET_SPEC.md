# ランク・シーズン報酬／アセット仕様

更新日: 2026-09-26
状態: **ランクフレーム・報酬仕様実装済み（Master限定スキンは設定待ち）**
この文書はランク報酬コードと正式プロフィールフレーム素材の基準である。Master限定スキンはシーズン設定が確定するまで安全な保留状態を維持する。

## 1. 確定ランク帯

| ランク | RP範囲 | 到達時プロフィールフレーム | シーズン確定コイン |
|---|---:|---|---:|
| Bronze | 0〜99 | Bronze（初期所有） | 0 |
| Silver | 100〜199 | Silver（永久解放） | 200 |
| Gold | 200〜349 | Gold（永久解放） | 400 |
| Platinum | 350〜549 | Platinum（永久解放） | 800 |
| Diamond | 550〜799 | Diamond（永久解放） | 1,200 |
| Master | 800以上 | Master（永久解放） | 1,500 + 当該シーズン限定スキン |

- 勝利: `+10 RP`
- 敗北: `-6 RP`
- RP下限: `0`
- 降格あり。ランク名は保存値ではなくRPから再計算する。
- ランダムマッチの正式結果だけを対象とし、部屋対戦・CPU・ローカル対人は対象外とする現行方針を維持する。

## 2. 月次シーズンとソフトリセット

- 1シーズンは日本時間の暦月1か月。`seasonId`は`YYYY-MM`。
- 月またぎの試合は、サーバーで正式結果が確定した`completedAt`の月へ計上する。
- 前シーズンの`finalRank`、`finalRP`、勝敗、報酬資格は`seasonHistory`へ固定する。
- 到達済みプロフィールフレーム、所持スキン、その他の永久資産はリセットしない。

### 新シーズン開始RP

| 前シーズン最終ランク | 現行開始RP | 確定後の開始RP | 新シーズン表示ランク |
|---|---:|---:|---|
| Bronze | 0 | 0 | Bronze |
| Silver | 50 | 50 | Bronze |
| Gold | 150 | 150 | Silver |
| Platinum | 300 | **200** | Gold |
| Diamond | 500 | **200** | Gold |
| Master | 750 | **200** | Gold |

Bronze / Silver / Gold終了者は、現行のソフトリセット値`0 / 50 / 150`を維持する案を正式整理値とする。新閾値でも各RPからランクを一意に再計算でき、Silver終了者はBronze、Gold終了者はSilverへソフトリセットされる。Platinum / Diamond / Master終了者は指定どおり一律`200 RP`（Gold）から開始する。

## 3. プロフィールフレーム

正式IDは既存IDを維持する。

| ランク | profile frame ID | 所有条件 |
|---|---|---|
| Bronze | `rank_bronze` | 初期所有 |
| Silver | `rank_silver` | Silverへ初到達 |
| Gold | `rank_gold` | Goldへ初到達 |
| Platinum | `rank_platinum` | Platinumへ初到達 |
| Diamond | `rank_diamond` | Diamondへ初到達 |
| Master | `rank_master` | Masterへ初到達 |

- Silver以上は、そのランクへ一度でも到達した時点で永久解放する。
- 降格・シーズン切り替えで削除しない。
- Bronzeもランク報酬タブへ通常画像で表示する。
- Silver以上の未獲得表示には専用ロック画像を使う。通常フレームをCSSで黒塗りしない。
- フレーム到達報酬と、シーズン終了時のMaster限定スキンを混同しない。

## 4. シーズンMaster限定スキン

### 付与仕様

- 1シーズンにつき限定スキンは1種類。
- シーズン1はネコ、シーズン2は柴犬、以後ネコ／柴犬を基本的に交互にする。
- Masterへ途中到達しただけではスキンを付与しない。シーズン終了時の最終ランクがMasterの場合だけ受取資格を確定する。
- Masterの`1,500コイン`は常に付与する固定報酬であり、重複時の代替報酬ではない。
- 対象スキン未所持: スキンを1回付与し、さらに1,500コインを付与。
- 対象スキン所持済み: スキンを重複付与せず、1,500コインを付与。
- 未獲得スキンは専用collection/profileロック画像を使用し、CSS黒塗りは行わない。
- Master限定ネコは`catSkin`、Master限定柴犬は`dogSkin`へ所属する。
- ランク報酬タブにはMaster限定報酬の概要と、該当する猫図鑑／柴犬警察手帳の詳細へ移動する導線を置く。ランク報酬タブへキャラスキン本体を重複表示しない。

### 正式ID候補

現行の`cat_master_reward_pending` / `dog_master_reward_pending`は素材未確定用の仮IDであり、正式報酬には使わない。

| シーズン例 | 種別 | 正式ID候補 | 配置カテゴリ |
|---|---|---|---|
| Season 01 | ネコ | `cat_master_s01` | `catSkin` |
| Season 02 | 柴犬 | `dog_master_s02` | `dogSkin` |
| Season 03 | ネコ | `cat_master_s03` | `catSkin` |
| Season 04 | 柴犬 | `dog_master_s04` | `dogSkin` |

実装時はシーズン番号だけでなく、サーバー設定を`YYYY-MM -> skinId`で保持する。過去スキン復刻時は同じskinIdを別の`YYYY-MM`へ再指定できるようにする。

## 5. シーズン報酬の冪等性

現行の安全策を維持し、Masterの複合報酬へ拡張する。

- 正式対戦結果は`ranked:${matchId}:${playerId}` markerで一度だけRP・戦績へ反映。
- シーズン終了情報は`seasonHistory`へ同一`seasonId`を一度だけ追加。
- 受取済みseasonIdは`seasonRewardsClaimed`へ保存。
- `rewardStatus === claimed`または`seasonRewardsClaimed`に存在するseasonIdの再送は`already_claimed`。
- スキン所有リストはSet相当で重複を除外。
- Master受取処理は1回の原子的更新で「1,500コイン加算」と「未所持時だけスキン追加」を行う。片方だけ成功する状態を作らない。
- 報酬未設定時は`pendingConfiguration`として最終ランク・RP・資格を保持し、勝手に別報酬へ変換しない。

## 6. 実装状況（2026-09-26 フレーム正式実装後）

### 現在のランク閾値

`server/ranked-progression.mjs`と`rank-rewards.js`は、確定値の0 / 100 / 200 / 350 / 550 / 800へ更新済み。

### 現在のシーズン報酬

- サーバー: Silver 200 / Gold 400 / Platinum 800 / Diamond 1,200
- UI (`rank-rewards.js`): Silver 200 / Gold 400 / Platinum 800 / Diamond 1,200 / Master 1,500
- UIとサーバーのSilver〜Diamondは一致済み。

### 現在のソフトリセット

`RESET_RP`はBronze 0 / Silver 50 / Gold 150 / Platinum 200 / Diamond 200 / Master 200へ更新済み。

### 現在のMaster報酬

- `MASTER_REWARD_PERIODS`を`YYYY-Qn -> skinId`として扱う3か月単位。
- 未所持時は`rewardType: skin`でスキンだけを付与。
- 所持済み時は`rewardType: coins`で1,500コインだけを付与。
- したがって「1,500コイン常時 + 未所持時だけスキン」ではない。
- サーバー既知報酬スキンは現在`cat_kaitou` / `dog_detective`だけで、Master専用正式スキンは未登録。
- 仮カタログIDは`cat_master_reward_pending` / `dog_master_reward_pending`。

### 現在のプロフィールフレーム

- 互換性のためサーバー既存ID `rank_bronze`〜`rank_master` を正式維持。
- Bronzeは初期所有、既存プロフィールも正規化時に安全に補完。
- CollectionへBronze〜Masterをランク順で登録済み。
- 正式PNG overlayを優先し、欠落・読込失敗時だけ既存CSSへfallbackする。
- Silver以上の未獲得時は通常PNGを表示しない。専用ロック画像は将来追加可能な`lockedImage`境界を用意済み。

## 7. 確定仕様と現在コードの差分

| 項目 | 現在 | 確定仕様 | 修正要否 |
|---|---|---|---|
| Gold閾値 | 200 | 200 | 完了 |
| Platinum閾値 | 350 | 350 | 完了 |
| Diamond閾値 | 550 | 550 | 完了 |
| Master閾値 | 800 | 800 | 完了 |
| UI Platinum報酬 | 800 | 800 | 完了 |
| UI Diamond報酬 | 1,200 | 1,200 | 完了 |
| 上位3ランクのreset | 200 / 200 / 200 | 200 / 200 / 200 | 完了 |
| Master切替単位 | 四半期 | 毎月 | 必要 |
| Master通常報酬 | 未所持ならスキンのみ | スキン + 1,500 | 必要 |
| Master重複報酬 | 1,500のみ | 1,500のみ | 一致 |
| Master交互運用 | 自動規則なし | 猫／柴犬を基本交互 | 設定検証が必要 |
| Bronzeフレーム一覧 | 表示 | 表示 | 完了 |
| フレーム画像 | PNG優先＋CSS fallback | 専用通常画像 | 完了 |
| 未獲得フレーム | CSS表示 | 専用ロック画像 | 必要 |
| Master仮ID | pending ID | シーズン別正式ID | 必要 |

## 8. 今後コード修正が必要な箇所

- `server/ranked-progression.mjs`: `RANKS`、`RESET_RP`、月別Master設定、複合報酬生成・受取。
- `server/online-profile.mjs` / `server/worker.mjs`: 正式Masterスキンallowlistと月別設定の受け渡し。
- `rank-rewards.js`: 新閾値、800/1,200、Bronzeフレーム、Master説明。
- `collection-catalog.js`: Bronzeフレーム、全フレーム画像とロック画像、正式Masterスキン。
- `collection.js` / profile frame表示: 未獲得時の専用ロック画像分岐と詳細導線。
- `style.css` / `online-profile-ui.js` / `ranked-ui.js`: 画像フレーム表示への対応。既存CSSは画像欠落時fallbackとして残すか次工程で判断。
- `GAME_SPEC.md` / `ONLINE_RANKED_SEASONS.md`: 確定仕様へ更新。
- ランク・UI・シーズン受取・冪等性テスト一式。

## 9. 必要画像一覧

### プロフィールフレーム

推奨配置: `assets/images/rank/profile-frames/`
通常フレームはプロフィール表示・一覧・詳細で同一PNGを流用する。推奨は正方形`1024 x 1024`、透過PNG、顔領域を中央65〜72%空ける。

| 用途 | 推奨ファイル名 | 枚数 | 透過 | 備考 |
|---|---|---:|---|---|
| Bronze通常 | `rank_bronze_frame.png` | 1 | あり | 初期所有、ロック不要 |
| Silver通常／ロック | `rank_silver_frame.png` / `rank_silver_frame_locked.png` | 2 | あり | 専用シルエット |
| Gold通常／ロック | `rank_gold_frame.png` / `rank_gold_frame_locked.png` | 2 | あり | 専用シルエット |
| Platinum通常／ロック | `rank_platinum_frame.png` / `rank_platinum_frame_locked.png` | 2 | あり | 専用シルエット |
| Diamond通常／ロック | `rank_diamond_frame.png` / `rank_diamond_frame_locked.png` | 2 | あり | 専用シルエット |
| Master通常／ロック | `rank_master_frame.png` / `rank_master_frame_locked.png` | 2 | あり | 専用シルエット |

合計: **11枚**。

### Season 01 Master限定ネコ

推奨配置: `assets/images/skins/master_s01/`。既存ネコスキンと同等の実装範囲を満たす。

- `cat_master_s01_collection.png`
- `cat_master_s01_collection_locked.png`
- `cat_master_s01_profile.png`
- `cat_master_s01_profile_locked.png`
- `cat_master_s01_piece.png`
- `cat_master_s01_result_win.png`
- `cat_master_s01_result_lose.png`
- `cat_master_s01_effect_move.png`
- `cat_master_s01_effect_found.png`
- `cat_master_s01_home_decor.png`
- `cat_master_s01_home_character.png`
- `cat_master_s01_home.png`

合計: **12枚**。collection/profileのロック版は通常画像からCSS生成せず、別PNGとして制作する。

### Season 02 Master限定柴犬

推奨配置: `assets/images/skins/master_s02/`。3匹の盤面駒を個別に持つ。

- `dog_master_s02_collection.png`
- `dog_master_s02_collection_locked.png`
- `dog_master_s02_profile.png`
- `dog_master_s02_profile_locked.png`
- `dog_master_s02_red_piece.png`
- `dog_master_s02_black_piece.png`
- `dog_master_s02_white_piece.png`
- `dog_master_s02_result_win.png`
- `dog_master_s02_result_lose.png`
- `dog_master_s02_effect_move.png`
- `dog_master_s02_effect_found.png`
- `dog_master_s02_home_decor.png`
- `dog_master_s02_home_character.png`
- `dog_master_s02_home.png`

合計: **14枚**。以後のMasterスキンも猫12枚／柴犬14枚を基本テンプレートとする。

## 10. 次工程の制作順

1. 最初に`rank_bronze_frame.png`を制作し、プロフィール円形表示・44px相手表示・コレクション一覧で基準寸法と中央の顔領域を確定する。
2. 同じ基準でSilver〜Master通常フレーム5枚を制作する。
3. Silver〜Master専用ロック画像5枚を制作する。
4. Season 01のMaster限定ネコについて、まずcollection / collection_locked / profile / profile_locked / pieceの5枚でキャラクターデザインを確定する。
5. デザイン確定後、Season 01の残り7枚へ展開する。
6. Season 02の柴犬はSeason 01とフレーム実装のQA完了後に制作する。

最初に作成すべき単体アセットは **`rank_bronze_frame.png`**。最初にデザイン確定すべき報酬スキン素材群は **Season 01 Master限定ネコのcollection/profile/pieceと各ロック版** とする。

## 11. `rank_bronze_frame.png` 制作基準

この節はBronzeフレーム1枚だけの制作仕様である。Silver以上、ロック画像、Master限定スキンはまだ制作しない。既存CSSフレームも削除せず、PNG表示を実装する段階までfallbackとして維持する。

### 11.1 現在のプロフィールフレーム描画

現状はフレーム画像を使用しておらず、共通DOM `.ranked-frame-preview` のCSS `border` / `box-shadow` / `::before` / `::after` でランク色を表現している。

| 表示箇所 | 使用DOM | 現在の内容領域 | CSS外周 | 実占有目安 | avatar |
|---|---|---:|---:|---:|---|
| 自分のランクプロフィール | `.ranked-frame-preview[data-rank-frame-preview]` | 48 x 48px | 4px double border + 最大2px shadow | 約60 x 60px | 内部`img`を100% x 100%、`object-fit: contain`、`border-radius: 50%` |
| オンライン相手プロフィール | `.online-profile-frame` | 44 x 44px | 共通の4px border + shadow | 約56 x 56px | フレームDOM内の`img`を100% x 100%。汎用36px指定は、より詳細な44px指定で上書きされる |
| ランク報酬モーダル | `.rank-reward-frame` | 38 x 38px（小画面32px） | 3px border | 約44 x 44px（小画面38px） | 現状はCSSフレームのみ |

- 共通DOMは`position: relative`、`display: grid`、`place-items: center`、`border-radius: 50%`。
- 現状のDOMではavatar画像がフレーム要素の子であり、PNG overlay専用要素はまだない。
- オンライン相手表示は`online-profile-ui.js`が`span.ranked-frame-preview.online-profile-frame`を作り、その中へavatarの`img`を追加する。
- `setFrame()`は画像パスを設定せず、検証済みframe IDを`data-frame-id`へ設定するだけである。
- `overflow`は明示されておらず初期値`visible`。既存の肉球疑似要素が円外へ出る構成になっている。
- Bronze画像導入時も、avatarの円形切り抜きとフレームPNGの重なり順を分け、フレーム自体を`overflow: hidden`で切らない。

### 11.2 推奨PNG仕様

| 項目 | 確定値 |
|---|---|
| ファイル名 | `rank_bronze_frame.png` |
| 配置予定 | `assets/images/rank/profile-frames/rank_bronze_frame.png` |
| キャンバス | **1024 x 1024px** |
| 形式 | RGBA PNG、背景完全透過 |
| 基準中心 | `(512, 512)` |
| 外形 | 全ランク共通の正円リング／額縁型 |
| 顔抜き | 中央直径 **700px**（半径350px、キャンバスの68.4%）を完全透過 |
| 基本リング | 内径700pxから外径928pxまで。半径方向114px（キャンバス幅の11.1%）を基本造形領域とする |
| 外周安全領域 | 四辺48pxは原則透明。基本外径928pxは`x/y=48〜976`に収める |
| 装飾上限 | 肉球など少数の突起のみ四辺24pxまで接近可。キャンバス外へ出さない |
| 顔保護領域 | 中央700px内へ不透明画素、影、光、金具、文字を入れない |
| 向き | 正面。装備対象のavatarを回転・移動させない左右対称基準 |

顔抜き直径700pxは、現行の44px表示で約30.1px、48px表示で約32.8pxに相当する。現在のCSS 4px枠に近い視認性を保ちながら、顔・耳・兜などプロフィール画像の主要部を隠しにくい比率である。

Bronzeの表現は、鈍い赤銅色・明るい銅色・控えめな木／革調の陰影を基本とする。輪郭形状、顔抜き位置、全体の占有率はSilver〜Masterでも変更せず、材質、色、光沢、外周の小装飾だけを段階的に豪華にする。

### 11.3 表示サイズと縮小比率

1024px原寸を1.0とした表示基準。CSSサイズは将来のPNG overlay実装時の目標値であり、現行CSSフレームの削除指示ではない。

| 用途 | 表示目安 | 原寸比 | 備考 |
|---|---:|---:|---|
| 自分のプロフィール／ランクカード | 56 x 56px | 5.47% | 現在の48px内容 + 4px枠相当。overlayは56px正方形内へ収める |
| オンライン相手プロフィール | 52 x 52px | 5.08% | 現在の44px内容 + 4px枠相当。小サイズでもリングが途切れないこと |
| ランク報酬モーダル | 44 x 44px、小画面38 x 38px | 4.30%、3.71% | 最小確認サイズ。細線・小文字は禁止 |
| Collection一覧 | 78〜112px | 7.62〜10.94% | `.collection-item-preview`の高さ。正方形PNGを`object-fit: contain`で表示 |
| Collection詳細 | 基本190px以上 | 18.55%以上 | `.collection-detail-main-image`内で正方形を`object-fit: contain`。画面高により拡大可 |
| Collection内プロフィールプレビュー | 58 x 58px | 5.66% | 現在のavatarプレビュー寸法と同等 |

Collection一覧は2列グリッドで、プレビュー枠の高さが`clamp(78px, 17dvh, 112px)`、小画面では72pxへ縮む既存指定もある。したがってBronzeフレームは**最小38px、通常44〜58px、一覧72〜112px、詳細190px以上**のすべてで輪郭が成立する必要がある。

### 11.4 PNG overlay実装時の基準

コード実装は次工程とし、本工程では以下を採用予定の表示方式として確定する。

1. avatarを円形レイヤーとして中央へ置く。
2. `rank_bronze_frame.png`を別の`img`または疑似要素として`position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none;`で最前面へ重ねる。
3. avatarだけを`border-radius: 50%; overflow: hidden`の内側ラッパーで切り抜く。外側のフレームコンテナは`overflow: visible`を維持する。
4. avatarの表示円はフレーム全体の約68.4%を基準とし、中央からずらさない。
5. `data-frame-id="rank_bronze"`からカタログのframe assetを解決する。オンライン同期では従来どおりframe IDだけを送り、画像パスは送らない。
6. PNG未読込・asset未定義時は、既存CSSフレームへfallbackする。既存CSSは全ランク画像とQAが揃うまで削除しない。

### 11.5 Bronze制作・受入条件

- 1024 x 1024pxの透過PNGである。
- 中央直径700pxが完全透過で、キャラクターの顔を隠さない。
- 主要造形は外径928px以内に収まる。
- 38px表示で輪郭が欠けず、Bronzeの銅色が識別できる。
- 52pxオンライン表示でavatarとフレームの中心が一致する。
- 72px Collection小画面表示で余白過多に見えない。
- 190px詳細表示で低解像度・輪郭の粗さ・透過縁の白いハローが見えない。
- 文字、ランク名、細すぎる彫刻線は入れない。
- Silver〜Masterへ同一マスク・同一外形を流用できるレイヤー構成で制作する。

**制作時の最終指定: `rank_bronze_frame.png`は1024 x 1024px、RGBA透過PNG、中央顔抜き直径700px、基本外径928pxで作成する。**

## 12. ランクフレームシリーズのアートディレクション

### 12.1 シリーズ共通コンセプト

ランクフレームは、スマホゲームとして直感的に格を読み取れる**王道メタル系**を基礎とする。その上で、にゃんチェイスらしい親しみやすさを、角を立てすぎない輪郭、丸みのある段差、控えめな肉球・足あとモチーフとして少量だけ加える。

- Bronze〜Goldは「上品な金属製フレーム」の範囲で段階的に豪華にする。
- Platinum以上は光、結晶、冷色のアクセントを追加し、Gold以下と一目で区別できる上位グループにする。
- Masterは最上位として唯一感を持たせる。ただし顔抜き位置と基本寸法を壊さず、プロフィール画像の視認性を優先する。
- 全ランクで中央顔抜き直径700px、中心座標、基本リング構造を共通化する。
- ランク差は主に材質、色、装飾密度、ハイライト、外周シルエットの小さな拡張で表現する。
- カジュアルで温かいゲーム世界を維持し、写実的すぎる重厚な甲冑、攻撃的な棘、暗く汚れた金属にはしない。
- 文字やランク名に依存せず、38px表示でも色と大きな造形だけで識別できるようにする。

シリーズの視覚的な格付けは、**Bronze < Silver < Gold << Platinum < Diamond < Master** とする。Goldまでは上品さを優先し、Platinumを境に明確に別格の見え方へ切り替える。

### 12.2 ランク別の差分方針

| ランク | 主色・材質 | 装飾量 | 光沢・発光 | 派手さ | 小サイズでの識別ポイント |
|---|---|---:|---|---:|---|
| Bronze | 赤みのある落ち着いた銅。磨きすぎないサテン調メタル | 最小。二重リングと小さな下部プレート程度 | 弱い金属ハイライト。発光なし | 1 / 6 | 温かい赤銅色、太く素直な二重リング |
| Silver | 明るく清潔な銀。わずかに青みのある上品な金属 | Bronzeより一段増やし、小さな縁飾りを追加 | 中程度の白い反射。発光は原則なし | 2 / 6 | 明るい銀色、整った細縁と一点の輝き |
| Gold | 深みのある金色。上品で高級な磨き金属 | 中程度。上下左右の節点や彫刻を追加可能 | 明確な金属光沢。小さな星状反射は可 | 3 / 6 | はっきりした金色、均整の取れた装飾リング |
| Platinum | 青白いプラチナ金属。淡い水色の冷たい差し色 | Goldより明確に多い。外周に小さな結晶・光片を追加 | 強めの冷たい光沢。控えめな発光可 | 4 / 6 | 青白い輪郭、冷色の光、上位らしい外周拡張 |
| Diamond | 透明感のある水色〜青の宝石と白銀 | 多い。結晶ファセットをリズミカルに配置 | 強いきらめきと点光。中央顔領域には入れない | 5 / 6 | 青い結晶形、鋭い光点、宝石特有の明暗差 |
| Master | 深い紫・紺を軸に、金または虹彩を限定的に使用 | 最大。ただし顔の周囲を詰めない | 最も強いが、白飛びや常時大面積発光は避ける | 6 / 6 | 上部または左右の固有シンボル、紫・金の配色、唯一の外周シルエット |

Masterのみ、基本外径928pxと中央顔抜きを維持したまま、安全領域内で上部・左右へ固有シンボルを追加してよい。「王冠そのもの」を大きく載せるのではなく、肉球、月、星、追跡の軌跡など本作の要素を抽象化した紋章で唯一感を作る。

### 12.3 共通形状の展開ルール

1. Bronzeの二重リング、中央顔抜き、中心位置をシリーズのマスター形状とする。
2. SilverとGoldはリング幅を極端に変えず、表面処理・縁飾り・節点装飾を追加する。
3. Platinumから外周へ小さな結晶・光片を追加できるが、主要造形は外径928px以内を基本とする。
4. Diamondは結晶の角を増やしてよいが、内周は丸く保ち、顔側へ棘を向けない。
5. Masterは外周シルエットに固有性を許可するが、中央700pxと四辺24pxの限界を厳守する。
6. すべてのランクを同じavatar、同じCSS座標、同じ画像ボックスで交換可能にする。
7. 38px時に消える微細装飾は、ランク識別の必須要素にしない。

## 13. Bronzeフレーム制作ガイド

### 13.1 完成イメージ

`rank_bronze_frame.png`は、丸みのある二重リングを基礎にした、赤銅色のプロフィール額縁とする。外側リングは落ち着いた濃い赤銅、内側リングは少し明るい銅色とし、左上に弱い暖色ハイライト、右下に柔らかな陰影を置いて厚みを表現する。新品の鏡面金属ではなく、丁寧に手入れされたサテン調の銅を目指す。

下部中央にはリングと一体化した小さな装飾プレートを置いてよい。プレートは横長で丸みのある形とし、中央へ極小の抽象的な肉球または足あと刻印を1点だけ入れる。刻印はランク識別の主役にせず、38px表示では「小さな中央アクセント」として残る太さにする。上部、左右には大きな飾りを置かず、初期所有フレームとして自然な控えめさを維持する。

求める印象は「簡素」ではなく、**堅実・親しみやすい・丁寧に作られた最初のランクフレーム**である。Goldのような豪華さ、Platinum以上の神秘性は入れない。

### 13.2 色・材質

推奨色域は制作時の目安であり、最終的にはゲーム画面上の見え方を優先する。

| 部位 | 色・明度の目安 | 表現 |
|---|---|---|
| 外側リング | 深い赤銅 `#7A3F2B`〜`#9B5838` | 輪郭を締める。黒や焦げ茶まで沈ませない |
| 内側リング | 明るい銅 `#B66A43`〜`#D08A5A` | avatarとの境界を明確にする |
| ハイライト | 薄い暖色銅 `#E2A574`前後 | 左上へ細く、面積を小さくする |
| 陰影 | 赤茶 `#5E3328`前後 | 右下へ柔らかく。真っ黒な縁取りは避ける |
| 下部プレート | リングと同系色 | 少しだけ明暗差を付け、別素材には見せない |

- 金属ノイズや細かな傷は原寸でごく弱く入れてよいが、縮小時に汚れへ見えないようにする。
- 鏡面反射ではなく、幅の広い柔らかなハイライトを使う。
- 色相はGoldと混同しないよう黄色へ寄せすぎず、赤みを明確に残す。
- 茶色一色の木製フレームには見せない。必ず金属の段差と反射を持たせる。

### 13.3 形状とレイヤー構造

- キャンバス: 1024 x 1024px。
- 中央: `(512, 512)`。
- 顔抜き: 直径700pxの完全透過円。
- 基本外径: 928px。
- 二重リングは、内縁・主リング・外縁の3段階の明暗で表現する。
- 主リングの見かけ幅は、半径方向114pxの造形領域のうち約72〜88pxを使う。
- 内縁と外縁はそれぞれ8〜18px程度の太い面として描き、1〜3pxの細線だけにしない。
- 下部プレートは中央`x=512`を基準とし、幅150〜210px、高さ54〜78px以内を目安とする。
- 下部プレートを含む全造形を原則`x/y=48〜976`へ収める。
- 影はキャンバス内へ収め、半透明の影が顔抜き700px内へ侵入しないようマスクする。
- 制作元データでは、外リング、内リング、ハイライト、陰影、下部プレート、刻印を別レイヤーにする。Silver以降へ形状を再利用できる状態を保つ。

### 13.4 にゃんチェイスらしさの入れ方

- 全体輪郭の角を丸め、硬派すぎない印象にする。
- 肉球／足あとを使用する場合は、下部プレートの浅い刻印1点に限定する。
- 猫耳、犬耳、尻尾、骨、王冠などを外周へ大きく付けない。
- キャラクターイラストの可愛さと競合せず、どのネコ／柴犬プロフィールにも合わせられる中立的な造形にする。

### 13.5 NG表現

- 宝石、クリスタル、発光オーラ、虹色反射。
- 王冠、大きな翼、旗、剣、炎、大量の星。
- Goldに見える黄色主体の配色。
- 黒ずみや傷を強調した古びた・汚れた銅。
- 写実的すぎる重厚な彫金、細密模様、読める文字。
- 顔抜き領域へはみ出す肉球、プレート、ハイライト、影。
- 38px表示で1px未満になる細い線を主要輪郭に使用すること。
- 左右非対称が強く、avatarが傾いて見える構図。
- 下部装飾が大きすぎて首元・胸元を隠す構図。

### 13.6 表示サイズ別の注意

| 表示サイズ | 確認内容 |
|---:|---|
| 38px | 外周が連続した円として残る。赤銅色と下部アクセントを認識できる。刻印が消えても破綻しない |
| 44〜58px | avatarの目・耳・兜を隠さない。二重リングと弱い立体感が確認できる |
| 72〜112px | Collection一覧で余白過多にならず、下部プレートがノイズに見えない |
| 190px以上 | 金属の段差が自然。透過縁の白いハロー、荒いジャギー、不要な画像背景がない |

### 13.7 Bronze制作キーワード

**王道メタル、赤銅、サテン調、丸い二重リング、控えめ、上品、親しみやすい、柔らかな立体感、小さな下部プレート、抽象的な肉球刻印、初期所有でも自然、スマホ小サイズ優先。**

画像制作者へ渡す短縮指示:

> 1024 x 1024pxの透過PNG。中央直径700pxを完全に空け、外径928px以内に、赤みのある落ち着いた銅色の丸い二重リングを描く。弱いサテン光沢と柔らかな段差で安っぽく見せず、下部中央に小さな丸いプレートとごく控えめな抽象肉球刻印を置く。発光、宝石、王冠、羽根、細密装飾は入れない。38pxへ縮小しても輪郭と赤銅色が明確で、どのプロフィール顔も隠さないこと。

この仕様をBronzeの承認基準とし、Bronzeの実画像QAが完了するまでSilver以上の制作へ進まない。
