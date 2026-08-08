# SHIKA PHOTO LIBRARY

志賀町公式フォトライブラリー（[shika-town.github.io/photo-library](https://shika-town.github.io/photo-library/)）のソースです。

運営：志賀町役場 商工観光課

## このリポジトリの中身

| フォルダ | 内容 |
|---|---|
| `site/` | サイト本体。GitHub Pages で公開されます |
| `site/scripts/` | ページを組み立てるスクリプト |
| `site/data/` | 写真とスポットのデータ |
| `_source/photos/` | 切り出し前の元画像 |
| `.github/workflows/` | 自動更新の設定 |

## 更新のしかた

サイトの内容は Google スプレッドシートで管理しています。シートを直すと、平日の9時・12時・17時に自動で反映されます。

スプレッドシートを直接編集するのが不安な場合は、`管理画面_設置手順.md` の管理画面を入れてください。
写真登録・承認・写真の表示ON/OFF・キャプション変更・スポット説明の修正を、専用画面から行えます。

すぐ反映したいときは、上の「Actions」タブ →「サイトを更新して公開」→「Run workflow」を押してください。

手元で作り直す場合：

```
cd site
python3 scripts/build-all.py
```

詳しい手順は `site/README.md` をご覧ください。

## 写真の利用について

掲載写真の著作権は志賀町に帰属します。利用条件は[利用規約](https://shika-town.github.io/photo-library/terms.html)をご確認ください。
