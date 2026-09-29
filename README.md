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

## 共有機能（Googleログイン・メンバーで同期）
Supabase（データベース＋ログイン）を使います。設定するまでは「共有」タブは出ず、今まで通り端末だけで動きます。

1. Supabase でプロジェクトを作る（Region は Tokyo）
2. SQL Editor に `supabase/schema.sql` を貼り付けて Run
3. Google Cloud で OAuth クライアント（ウェブ アプリケーション）を作り、承認済みリダイレクト URI に `https://<プロジェクトID>.supabase.co/auth/v1/callback` を登録
4. Supabase の Authentication → Sign In / Providers → Google に Client ID と Client Secret を入れて有効化
5. Supabase の Authentication → URL Configuration の Site URL と Redirect URLs に `https://ym-jugg.github.io/mahjong-score/` を登録
6. `config.js` に Project URL と anon（publishable）key を入れる

- `cloud.js` … Supabase とのやり取り
- `lib/supabase.js` … supabase-js（MIT License、`lib/supabase.LICENSE`）
- 閲覧リンク `?view=…` はログイン不要で見るだけ、招待リンク `?join=…` はログインして参加
