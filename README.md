# にゃんチェイス Ver1.9 — Phase1

Ver1.8系を継承しつつ、App Store / Google Play公開品質を目標にUI基盤を新規設計したPhase1です。

## Phase1の範囲

- HTML / CSS / Vanilla JavaScriptのみ
- GitHub Pagesでそのまま動作
- `css/`, `js/`, `assets/` のモジュール構成
- スマホ縦持ち・1画面を優先したレスポンシブUI
- 猫ターン / 柴犬ターンでテーマ・文言・操作UIが切り替わる
- 盤面Viewとゲーム状態を分離
- 設定UI（BGM ON/OFF、BGM音量、効果音）
- localStorageへの設定保存
- Safe Area対応
- `prefers-reduced-motion`対応
- 後続でCPU / オンライン対戦を追加しやすい状態モデルの入口を用意

## 重要

Phase1は「UI基盤」です。既存Ver1.8bの本番ゲームロジック（移動判定、探索、勝敗、演出等）はまだ接続していません。
盤面配置と選択可能マスはUI確認用デモです。

## ローカル確認

ES Modulesを利用しているため、ファイルを直接ダブルクリックするよりローカルサーバー経由を推奨します。

例:

```bash
python3 -m http.server 8080
```

その後 `http://localhost:8080` を開きます。

## GitHub Pages

このフォルダ内容をリポジトリ直下に配置し、GitHub PagesのDeploy from branchを有効にすれば動作します。

## 次Phase候補

Phase2ではVer1.8bのゲーム状態・ターン進行・盤面ロジックをこのUI基盤へ移植します。
UIとロジックを直接結合せず、Game Engine層を追加してCPU / Online Adapterへ拡張できる構造にします。
