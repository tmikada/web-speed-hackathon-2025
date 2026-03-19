# TTFB改善: SSR loaderのprefetchスキップ

## 計測結果（改善前）

| メトリクス | 値 | 備考 |
|-----------|-----|------|
| LCP | 1,442ms | TTFB が89%を占める |
| TTFB | 1,287ms | ボトルネック |
| CLS | 0.00 | 問題なし |
| CSS render-blocking | savings 0ms | 33KB、影響なし |

### LCP内訳
- TTFB: 1,287ms
- Load delay: 10ms
- Load duration: 4ms
- Render delay: 142ms

## 根本原因

SSR中にサーバーが自身の `/api/*` エンドポイントにHTTP fetchしていた（self-referential calls）。

### SSRリクエストフロー（トップページの場合）

```
ブラウザ → GET /
  → ssr.tsx: handler.query(request)
    → Document loader: fetchUser()
      → HTTP GET http://localhost:8000/api/users/me → DB query
    → HomePage loader: fetchRecommendedModulesByReferenceId()
      → HTTP GET http://localhost:8000/api/recommended/entrance → DB query
  → renderToPipeableStream() → HTML送信
```

- `API_BASE_URL` は `http://localhost:8000/api`（`workspaces/server/package.json`で設定）
- サーバーが自分自身にHTTPリクエスト → ネットワークオーバーヘッド + DB処理で1,287ms

### 各ページのSSR時API呼び出し

| ページ | API呼び出し |
|--------|------------|
| Document (root) | `GET /api/users/me` |
| HomePage | `GET /api/recommended/entrance` |
| EpisodePage | `GET /api/episodes/:id` + `GET /api/recommended/:id` |
| ProgramPage | `GET /api/programs/:id` + `GET /api/channels` + `GET /api/timetable` + `GET /api/recommended/:id` |
| SeriesPage | `GET /api/series/:id` + `GET /api/recommended/:id` |
| TimetablePage | `GET /api/channels` + `GET /api/timetable` |
| NotFoundPage | `GET /api/recommended/error` |

## 対応内容

### 1. CSS読み込み方式の修正

**ファイル**: `workspaces/client/src/app/Document.tsx`

```diff
- <link rel="preload" href="/public/main.css" as="style" />
- <link rel="stylesheet" href="/public/main.css" media="print" onLoad={(e) => (e.currentTarget.media = 'all')} />
+ <link rel="stylesheet" href="/public/main.css" />
```

- `media="print"` + React `onLoad` ハックはSSR時に動作しない（`onLoad`がサーバーで発火しない）
- SSR出力では `media="print"` のままCSSが適用されずFOUC発生
- 33KBなので通常のrender-blocking stylesheetで問題なし（savings 0ms）

### 2. SSR loaderでprefetchスキップ

**ファイル**: `workspaces/client/src/app/createRoutes.tsx`（全7箇所のloader）

```tsx
async loader() {
  if (typeof window === 'undefined') return {};
  return await prefetch(store);
}
```

- `typeof window === 'undefined'` でSSR判定
- SSR時は空オブジェクトを返してデータフェッチをスキップ
- クライアント側hydration後にデータ取得

### 3. invariantをearly returnに変更

データ未取得時にSSRがクラッシュしないようフォールバック。

| ファイル | 変更 |
|---------|------|
| `workspaces/client/src/pages/episode/components/EpisodePage.tsx` | `invariant(episode)` → `if (!episode) return null` |
| `workspaces/client/src/pages/series/components/SeriesPage.tsx` | `invariant(series)` → `if (!series) return null` |
| `workspaces/client/src/pages/program/components/ProgramPage.tsx` | `invariant(program)` → `if (!program) return null` |

クラッシュしないページ（対応不要）:
- HomePage: `modules.map(...)` → 空配列で空レンダリング
- TimetablePage: `Object.keys(record)` → 空オブジェクトで空レンダリング
- NotFoundPage: `modules[0] != null ?` → null check済み
- Document: `useAuthUser()` → null許容

## 設計判断

- LCP要素は `arema.svg`（静的画像）でデータフェッチに依存しない
- SSRはHTML構造（Layout、ナビゲーション、CSS）を提供すれば十分
- データ依存コンテンツはclient hydration後に取得・描画

## 期待される効果

- TTFB: ~1,287ms → ~100ms
- LCP: ~1,442ms → ~250ms（大幅改善）

## リスク

| リスク | 対策 |
|--------|------|
| CLS増加（データ読み込み後のレイアウトシフト） | 計測して確認。悪化したら重要データのみSSRで取得 |
| VRT差異 | VRTはJS実行後のスナップショットなので問題なし |

## 検証方法

```bash
pnpm run build && pnpm run start
# Chrome DevTools でパフォーマンストレース → TTFB確認
# VRT実行
pnpm run test
```
