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

- 通常のChromeで標準サイドパネルの開閉、左右の配置、幅変更、Google／Notionの表示を確認する。
- 旧版から更新後は既存Webページも再読み込みし、埋め込みサイドバーを除去する。
- 新規タブ、タブ操作、ブックマーク選択、広告ブロックを確認する。
- 未確認の手動項目はリリースノートに明記し、プレリリースで公開する。

## 配布方針

v1.0.21以降はChrome標準サイドパネルのみを配布する。content_scripts、ページへの自動注入、overlay.jsは生成しない。下ドック・ページ上のホバー／スワイプ開閉は配布機能ではない。
