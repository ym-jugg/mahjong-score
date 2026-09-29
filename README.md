# 麻雀スコア帳（ドラフト）

静的ファイルだけで動くPWAです。このフォルダをそのままHTTPSのホスティングに置けば、スマホで「ホーム画面に追加」できます。

- GitHub Pages / Netlify / Cloudflare Pages などに `index.html` ごとアップロード
- ローカル確認: `python3 -m http.server 8000` → http://localhost:8000
- データは端末のブラウザ（localStorage）に保存されます。オフラインでも動作します。

ファイル
- index.html … アプリ本体（HTML/CSS/JSを1ファイルに収めています）
- manifest.webmanifest … アプリ名・アイコン・表示モード
- sw.js … オフライン用キャッシュ（更新時は CACHE のバージョン名を上げてください）
- icon-192.png / icon-512.png … ホーム画面アイコン
