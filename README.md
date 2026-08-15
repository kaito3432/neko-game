# にゃんチェイス 開発基盤版

現在の Ver1.5.2 を、今後の CPU 対戦・オンライン対戦に向けて複数ファイルへ整理した版です。

## ファイル構成

- `index.html` — 画面の骨組み
- `style.css` — デザイン
- `engine.js` — ゲームルール
- `game.js` — UI・ゲーム進行
- `animation.js` — アニメーション
- `audio.js` — 効果音・設定
- `assets/images/` — 今後のイラスト
- `assets/audio/` — 今後のBGM・音素材

## この版で修正したバグ

柴犬が探索を開始した後、クンクン演出中にもう一度盤面を操作して
「探索＋移動」の2回行動ができてしまう問題を修正しました。

探索開始時点でその柴犬を `探索中` として確定し、
`actionLocked` が有効な間は盤面・柴犬カード・ターン終了操作を受け付けません。

## GitHub Pages へのアップロード

ZIPを展開し、`nyan_chase_project` フォルダの「中身」を
GitHub のリポジトリ直下へアップロードしてください。

リポジトリ直下が次のようになればOKです。

```text
index.html
style.css
engine.js
game.js
animation.js
audio.js
assets/
```

`index.html` がさらに一段下のフォルダに入らないようにしてください。


## Ver1.5.3 追加内容

- BGMを追加（外部音源なしの軽量Web Audio版）
- 設定画面で BGM ON/OFF
- 設定はブラウザに保存
- 9〜11ターンはBGMが少しだけ緊張感のあるパターンへ変化
- 勝利演出時はBGMを一時的に小さくして効果音を聞きやすく調整
- iPhoneなどの自動再生制限に対応し、最初のユーザー操作後からBGM開始
