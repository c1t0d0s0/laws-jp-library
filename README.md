# 法令図書館 — 日本の法令 全文検索

[houritsu](https://github.com/Kohei-Wada/houritsu)（e-Gov法令検索のデータを Markdown にしたもの）をもとに、
日本の法令を全文検索できる静的サイトを作り、GitHub Pages で公開します。

- **全文検索・閲覧**: 日本国憲法と、全法律（約2,100件、附則を含む）
- **法令名検索**: 政令・府省令・規則などを含む全 8,982 件（正式名称・読み・略称）。全文を収録していない法令は e-Gov へリンクします
- 検索結果から該当する条へ直接移動し、検索語に印が付きます。PC・スマートフォン両対応、ダークモード対応

## 仕組み

| 段階 | 内容 |
| --- | --- |
| `scripts/build.mjs` | Markdown → 法令ごとの HTML（本則 `law/<法令ID>/`、附則 `law/<法令ID>/fusoku.html`）、分類ページ、`data/laws.json`（法令名検索用） |
| `scripts/index.mjs` | [Pagefind](https://pagefind.app/)（extended 版：日本語の分かち書きに対応）で全文検索インデックスを作成。メモリ使用量を抑えるため、HTML 約45MBごとに索引を分け（`pagefind/`, `pagefind-2/`, …）、ブラウザ側で `mergeIndex` して横断検索します |
| `src/assets/search.js` | 検索語を `Intl.Segmenter` で分かち書きし、「主要法令の本則 → その他の本則 → 附則」の順に、語句どおりに一致するものを優先して表示します |

検索時は、インデックスのうち必要な断片だけを読み込みます。

## ローカルでのビルド

```sh
git clone https://github.com/Kohei-Wada/houritsu.git   # 法令データ
git -C houritsu checkout $(cat houritsu.ref)            # 任意：CI と同じ版に揃える
npm ci
npm run build        # HTML 生成（約6秒）＋ 索引作成（約2分、メモリ 約2GB）
npm run serve        # http://localhost:8080
```

- 一部の法令だけで試す場合: `ONLY=日本国憲法,刑法,民法 npm run build`
- 索引の分割サイズ（MB）を変える場合: `SHARD_MB=30 npm run build:index`（メモリが少ない環境向け）

生成物 `site/` は約430MB（HTML 約250MB、索引 約180MB）です。

## 公開（GitHub Pages）

1. このディレクトリを GitHub リポジトリにして push します（`houritsu/`、`site/` は `.gitignore` 済み）。
2. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
3. `main` へ push するたびに `.github/workflows/pages.yml` が実行され、houritsu の取得 → ビルド → デプロイが行われます。

法令データを更新するときは、`houritsu.ref` を新しいコミットの SHA に書き換えて push します。

アクセス解析を使う場合は、`config.js` の `GTM_ID`（GA4 の測定 ID）を設定します（空にすると無効になります。localhost では送信しません）。

## ライセンス

- コード: MIT（`LICENSE`）
- 法令データ: e-Gov法令検索（[公共データ利用規約 第1.0版](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)）、Markdown 変換は houritsu（CC BY 4.0）
