# GitHub Release 手順

公開先: https://github.com/nishiyuki0501-wanto/sideflow
初回配布: v1.0.12（プレリリース）

## 検証とパッケージ

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:ui
npm run package
```

- `package.json`、`package-lock.json`、`extension/manifest.json`のバージョンを一致させます。
- `artifacts/sideflow-<version>.zip`と同名の`.sha256`が公開用成果物です。
- ZIPを解凍し、`sideflow-extension`フォルダをChromeで読み込みます。
- `.github/workflows/check.yml`はpush/PR時にビルド・テストして成果物を保存します。Releaseは自動公開しません。
- リポジトリに含めるのはソースとロックファイルです。生成物、node_modules、環境変数ファイルは除外しています。

## 公開前に残る確認

- macOSの物理トラックパッドで素早い左右の反転、同方向の連続スワイプ、通常の縦スクロール、Chromeの履歴ジェスチャーとの干渉を確認する。
- 通常ページ、新規タブ、左／右／下ドック、更新前から開いているタブを確認する。
- 再配布ライセンスは未選定。公開者が選定してLICENSEを追加する。
- 次回更新時も検証済みコミットにバージョンタグを付けてReleaseを作成する。
- 初回公開は実機確認の結果がそろうまでプレリリースを推奨。

## リリースノートに含める対応範囲

これは独立したChrome拡張で、Arc/Diaの公式製品ではありません。
HTTP/HTTPSページとSideflowが置き換えた新規タブで動作します。
Chrome設定・拡張登録画面・Webストア・他拡張のページにスワイプUIを埋め込むことはできません。
他の新規タブ拡張との競合、サイトアクセス許可、拡張更新後のページ再読み込みが動作に影響します。
プロファイル別にテーマと取り込みブックマークを保存しますが、ChromeのCookieと実タブは共有です。

## データと権限

タブ・グループ・ブックマークをChrome APIから取得します。取り込みデータと設定は端末内の拡張ストレージに保存します。
元のブックマークを変更せず、取り込みだけでURLを開きません。検索を確定するとGoogle検索または入力URLへ移動します。
HTTP/HTTPSサイトへのアクセス権とscripting権限はページ内サイドバーの表示に使用します。
