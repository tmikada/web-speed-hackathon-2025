# テスト結果 #1（ベースライン / 最適化前）

## 概要

- **実行日**: 2026-02-11
- **結果**: 全12テスト / **全12失敗**（パス: 0）

## エラーパターン別分類

| パターン | 件数 | テスト |
|---------|------|-------|
| **Page crashed** | 6 | シリーズページ, エピソード(プレミアム×2), プログラム(放送前/中/後) |
| **タイムアウト (画像待ち)** | 4 | トップページ, エピソード(無料), 番組表, 404 |
| **タイムアウト (画像待ち - top.test)** | 1 | サイドバーロゴ画像表示 |
| **タイムアウト (addStyleTag)** | 1 | 認証(新規登録→ログアウト→ログイン) |

## テスト別結果

| # | テストファイル | テスト名 | 結果 | 所要時間 | エラー種別 |
|---|--------------|---------|------|---------|-----------|
| 1 | auth.test.ts | 認証 › 新規会員登録 -> ログアウト -> ログイン | ❌ | 5.5m | タイムアウト (addStyleTag) |
| 2 | full-page.test.ts | 全画面 › トップページ | ❌ | 5.5m | タイムアウト (画像待ち) |
| 3 | full-page.test.ts | 全画面 › シリーズページ | ❌ | 33.6s | Page crashed |
| 4 | full-page.test.ts | 全画面 › エピソードページ (無料) | ❌ | 5.5m | タイムアウト (画像待ち) |
| 5 | full-page.test.ts | 全画面 › エピソードページ (プレミアム - 無料ユーザー) | ❌ | 35.1s | Page crashed |
| 6 | full-page.test.ts | 全画面 › エピソードページ (プレミアム - プレミアムユーザー) | ❌ | 28.3s | Page crashed |
| 7 | full-page.test.ts | 全画面 › プログラム（放送前） | ❌ | 35.1s | Page crashed |
| 8 | full-page.test.ts | 全画面 › プログラム（放送中） | ❌ | 39.6s | Page crashed |
| 9 | full-page.test.ts | 全画面 › プログラム（放送後） | ❌ | 32.0s | Page crashed |
| 10 | full-page.test.ts | 全画面 › 番組表 | ❌ | 5.5m | タイムアウト (画像待ち) |
| 11 | full-page.test.ts | 全画面 › 404 | ❌ | 5.0m | タイムアウト (画像待ち) |
| 12 | top.test.ts | サービストップ › サイドバーにロゴ画像が表示されていること | ❌ | 5.0m | タイムアウト (画像待ち) |

## エラー詳細

### 1. Page crashed（6件）

`page.goto` でページ自体がクラッシュ。ページ遷移時にブラウザがクラッシュしている。バンドルサイズが大きすぎてメモリ不足になっている可能性が高い。

```
Error: page.goto: Page crashed
```

### 2. タイムアウト — 画像ロード待ち（5件）

`waitForImageToLoad` で `main img` または `getByRole('img')` を待っているが、画像が表示されずに300秒(5分)のタイムアウト。ページは開けるが描画が完了しない。

```
Error: locator.scrollIntoViewIfNeeded: Test timeout of 300000ms exceeded.
Call log:
  - waiting for locator('main img').first()
```

### 3. タイムアウト — Google Fonts読み込み（1件）

`page.addStyleTag` でGoogle Fontsの外部CSSの読み込みがタイムアウト。ネットワーク環境の問題の可能性。

```
Error: page.addStyleTag: Test timeout of 300000ms exceeded.
  url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap'
```

## 所見

- **最大の問題**: 12件中6件がPage crashedで、ページすら開けない状態。巨大なバンドルサイズ（`LimitChunkCountPlugin`によるチャンク統合、production modeでないビルド等）が原因と考えられる
- **次の問題**: 残りもページ描画が完了せずタイムアウトしており、SSR未活用・画像プリロード等の問題が絡んでいる
- これは**最適化前のベースライン**の状態
