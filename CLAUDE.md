# Care Shift AI（シフト作成アプリ）開発メモ

Codex/Claude共通で参照する開発コンテキスト。SNS自動運営とは無関係の別プロジェクト。

## スマホ希望提出ページ（Apps Scriptウェブアプリ）

職員がスマホから希望休を出す専用ページを2026-06-29に構築・実機テスト済み。Googleフォームでは「氏名の自動反映・カレンダー複数選択・送信前確認画面」ができないため、Apps Scriptのウェブアプリで自作した。

**構成**：Apps Scriptウェブアプリ（`スマホ入力ページ_AppsScript/Code.gs`＋`Index.html`）がスマホページをホスト → 回答はスプレッドシート`1O3CHsgE74jN7KJDTPYBJ9W1DkYN8Xl4PZCpUboXub7g`の1枚目(gid=62709528)に追記 → アプリの「希望休・条件→スマホ希望を取り込む」で読込。氏名プルダウンは「名簿」シートから読み、アプリのスタッフ保存時に自動POSTで更新。

**本番URL**：
- スマホページ(LINE配布用)=ウェブアプリ `https://script.google.com/macros/s/AKfycbwJJ_2pAkDD4c-OmI7aLDccf4wRuHovCtFLPFczb5fpWbxYaGvCbDp9-EgCyPe49q4Y1Q/exec`
- アプリ取込用CSV `https://docs.google.com/spreadsheets/d/1O3CHsgE74jN7KJDTPYBJ9W1DkYN8Xl4PZCpUboXub7g/export?format=csv&gid=62709528`

**公開（Vercel）**：本体アプリは `https://care-shift-ai.vercel.app` で公開。GitHubリポジトリ `ailabolabo2023-pixel/care-shift-ai`（**Public**）。2026-06-29にVercel⇄GitHubのGit連携を設定済み＝**mainにプッシュすると自動デプロイ**される。古い5月版とローカル6月版は履歴が無関係だったため、6月版でforce push（上書き）して統一。内部ドキュメント（スマホ入力ページ_AppsScript/・スマホ希望提出_セットアップ手順.md）は.gitignoreで公開リポジトリから除外。⚠️本番の実名・希望を入れる前にリポジトリのPrivate化を推奨（公開だと回答シートURL/エンドポイントが辿られ得る）。

**重要な注意**：
- CSVは必ず `export?format=csv` を使う。`gviz/tq?tqx=out:csv` は行が増えると型推定で1行目データが空に化ける不具合あり（実機で確認）。
- `formImport.js` は `XLSX.read(text,{raw:true})` で文字列のまま読む（"2026-07"のExcel日付化を防ぐ）。
- コード修正後は必ず再デプロイ。「デプロイを管理→既存を編集→バージョン:新規」ならURL不変。「新しいデプロイ」だとURLが変わり貼り替えが必要。
- Apps Scriptの認証/デプロイ承認の別ウィンドウはAIが操作できない＝ユーザーに依頼する。詳細は`スマホ入力ページ_AppsScript/README_セットアップと運用.md`。
