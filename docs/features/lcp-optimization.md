# LCP最適化

## 問題

全9ページでLCPスコアがほぼ0。初期HTMLが空シェルで、ブラウザがJS実行→API取得→画像ダウンロードの長いウォーターフォールを経てからLCP要素を表示していた。

## 根本原因

### 1. SSR loaderがサーバーサイドでデータ取得をスキップ

`createRoutes.tsx` の全loaderに `if (typeof window === 'undefined') return {};` ガードがあり、SSRでデータが取得されなかった。

### 2. zustandのSSR問題（最重要）

zustandの `useStoreWithEqualityFn` は内部で `useSyncExternalStoreWithSelector` を使用し、SSRでは第3引数の `getServerSnapshot` = `api.getInitialState`（空の初期状態）を返す。

つまり **prefetchでstoreを更新しても、SSRレンダリング時には常に空の初期状態が使われる**。

### 3. 画像のlazy loadingとfetchPriority未設定

Above-the-fold画像に `loading="lazy"` が設定されており、画像の読み込みが遅延していた。

## 対応内容

### SSR修正

| ファイル | 変更内容 |
|---------|---------|
| `workspaces/client/src/app/createRoutes.tsx` | 全7箇所の `typeof window === 'undefined'` ガードを削除 |
| `workspaces/server/src/ssr.tsx` | prefetch後のstateで新しいstoreを作成し直す（`createStore({ hydrationData: store.getState() })`） |

### 画像最適化

| ファイル | 変更内容 |
|---------|---------|
| `workspaces/client/src/features/recommended/components/SeriesItem.tsx` | `loading="lazy"` → `fetchPriority="high"` |
| `workspaces/client/src/features/recommended/components/EpisodeItem.tsx` | `loading="lazy"` → `fetchPriority="high"` |
| `workspaces/client/src/features/series/components/SeriesEposideItem.tsx` | `loading="lazy"` 削除 |
| `workspaces/client/src/pages/episode/components/EpisodePage.tsx` | サムネイル2箇所に `fetchPriority="high"` 追加 |
| `workspaces/client/src/pages/series/components/SeriesPage.tsx` | サムネイルに `fetchPriority="high"` 追加 |
| `workspaces/client/src/features/recommended/components/JumbotronSection.tsx` | Player背後にサムネイル画像追加（LCP候補化） |
| `workspaces/client/src/app/Document.tsx` | `<link rel="preconnect" href="/api"/>` 追加 |

## 技術詳細：zustand SSR問題

```
zustand/esm/traditional.mjs:
  useSyncExternalStoreWithSelector(
    api.subscribe,      // subscribe
    api.getState,       // getSnapshot (client)
    api.getInitialState, // getServerSnapshot (SSR) ← 常に初期状態を返す
    selector,
    equalityFn
  )
```

**解決策**: SSRでprefetch後、`store.getState()` の結果を `hydrationData` として新しいstoreを作成。新しいstoreの `getInitialState` にはprefetchデータが含まれるため、SSRで正しくレンダリングされる。
