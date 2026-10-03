# shadcn 4.21.0 `dist/tailwind.css` の出所

このディレクトリの `tailwind.css` は、npm パッケージ `shadcn` 4.21.0 の `dist/tailwind.css` をバイト列のまま置いたものです。パッケージの `exports["./tailwind.css"]` がこのファイルを指していました。`globals.css` はこのローカルファイルを読みます。

`LICENSE.md` は同じパッケージに同梱されていた MIT ライセンス本文です。文言は変えません。Dashboard の本番ビルドと webview ビルドは、このファイルを出力先の `shadcn-4.21.0-LICENSE.md` へバイトのままコピーします。webview の出力は VSIX の `media/dashboard` に入ります。

ローカルパスはディレクトリ名 `dist` を避けています。`.gitignore` がその名前を無視します。出所のパスは下表の source path です。

下表のキーは回帰テストが読む識別子です。更新手順は `docs/maintenance/dependency-quality.md` の「shadcn のスタイルシートを手元に固定する」にあります。この CSS は oxfmt の対象外です。整形しません。

| 項目 | 値 |
| --- | --- |
| package | shadcn |
| version | 4.21.0 |
| source path | dist/tailwind.css |
| export | ./tailwind.css |
| integrity | sha512-UU2mFNusW8C5rvadKdH69vERYZqUlOOlXBcf0MYhYLdTGP6DPti7X4qovCu+RTfCqsAgq/T+YfE0Vnttxh9aiw== |
| repository | https://github.com/shadcn-ui/ui.git |
| repository directory | packages/shadcn |
| license | MIT |
| css sha256 | bc7d83425702955b4cb67cb14ede9d603f9d912376d57a2d81d661094d2a782a |
| license sha256 | 1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f |
| advisory | GHSA-vfj7-8cjw-p6xm |
| cve | CVE-2026-93687 |
| distributed license | shadcn-4.21.0-LICENSE.md |
