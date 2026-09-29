# 麻雀スコア帳

半荘ごとの持ち点を入れると、ウマ・オカ・チップ・同点処理込みでptと金額を計算するPWA。
自動卓（AMOS系）の点数表示を撮影して読み取る機能付き（端末内で処理）。

## ファイル
- `index.html` … 画面の骨組み
- `style.css` … 見た目
- `app.js` … ルール・計算・画面の動き（データは端末の localStorage に保存）
- `ocr.js` … 自動卓の7セグ表示の読み取り
- `sw.js` … オフライン対応（ネット優先、つながらないときはキャッシュ）
- `manifest.webmanifest` / `icon-*.png` … ホーム画面アプリ用の設定

## 公開
GitHub Pages（Settings → Pages → main / root）。
