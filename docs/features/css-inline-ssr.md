# CSS インライン化によるレンダリングブロック解消

## 問題

`<link rel="stylesheet" href="/public/main.css" />` が `<head>` にあるため、ブラウザは CSS をダウンロード・パースするまでレンダリングを停止する（Lighthouse "Eliminate render-blocking resources" 対象）。

### 過去の試み（失敗）

`media="print"` + React `onLoad` ハック:

```tsx
<link rel="stylesheet" href="/public/main.css" media="print" onLoad={(e) => (e.currentTarget.media = 'all')} />
```

**失敗理由**: React SSR は関数ベースのイベントハンドラを HTML にシリアライズしない。SSR 出力では `media="print"` のまま CSS が適用されず FOUC 発生 → revert（コミット fe39896）。

## 解決策

SSR 時に `main.css` の内容を `<style>` タグにインライン展開し、外部 HTTP リクエストを排除する。

## 実装

### 新規ファイル: `workspaces/client/src/app/CssContext.ts`

```ts
import { createContext, useContext } from 'react';
export const CssContext = createContext('');
export const useCss = () => useContext(CssContext);
```

### `workspaces/server/src/ssr.tsx`

サーバー起動時に `main.css` をファイルから読み込み（1回のみ）、React Context 経由で渡す:

```ts
const cssFilePath = path.resolve(..., '../../client/dist/main.css');
let cssContent = '';
try {
  cssContent = readFileSync(cssFilePath, 'utf-8');
} catch {
  // CSS 未ビルド時はフォールバック
}
```

`renderToPipeableStream` のラッパーに `CssContext.Provider` を追加:

```tsx
<CssContext.Provider value={cssContent}>
  <StoreProvider createStore={() => hydratedStore}>
    <StaticRouterProvider ... />
  </StoreProvider>
</CssContext.Provider>
```

SSR エラー時のフォールバック HTML に `<link rel="stylesheet">` を追加（純粋 CSR 用）:

```html
<head>
  <link rel="stylesheet" href="/public/main.css">
  <script defer src="/public/main.js"></script>
</head>
```

### `workspaces/client/src/app/Document.tsx`

```tsx
const contextCss = useCss(); // SSR では full CSS、クライアントでは ''

const [cssContent] = useState(() => {
  if (contextCss) return contextCss; // SSR パス
  // クライアントハイドレーション: SSR 済み <style> の内容を DOM から取得
  if (typeof window !== 'undefined') {
    return document.querySelector('style[data-main-css]')?.textContent ?? '';
  }
  return '';
});

// 純粋 CSR（SSR エラー後）: CSS 未ロードなら <link> を動的追加
useEffect(() => {
  if (!cssContent) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/public/main.css';
    document.head.appendChild(link);
  }
}, [cssContent]);
```

JSX:

```tsx
<style data-main-css="" dangerouslySetInnerHTML={{ __html: cssContent }} />
{/* <link rel="stylesheet" href="/public/main.css" /> は削除 */}
```

## 動作フロー

| フェーズ | cssContent の取得元 | `<style>` 内容 | 結果 |
|---------|-------------------|---------------|------|
| SSR | `CssContext`（サーバーでファイル読み込み） | 33KB CSS | CSS 即時適用・ブロックなし |
| クライアントハイドレーション | DOM の `style[data-main-css]` から読み込み | SSR と同じ 33KB | ハイドレーションミスマッチなし |
| 純粋 CSR（SSR エラー） | `''`（空）+ `useEffect` で `<link>` 追加 | 空 → 遅延ロード | CSS 遅延ロード（エラー時のみ） |

## ハイドレーションミスマッチ対策

クライアントは `CssContext` を持たない（Provider はサーバーのみ）ため、`useCss()` は空文字を返す。対策として `useState` イニシャライザ内で SSR 出力済みの `<style data-main-css>` の `textContent` を DOM から読み込む。これにより SSR とクライアントが同一内容をレンダリングし、ミスマッチが発生しない。

## 効果

- `main.css`（33KB、gzip 約 8KB）の外部リクエストが消える
- Lighthouse "Eliminate render-blocking resources" から `main.css` が除外される
- 初回ペイントが CSS ダウンロード待機なしで開始可能

## 注意事項

- `main.css` の内容が HTML レスポンスに含まれるため、レスポンスサイズが約 33KB 増加（gzip 圧縮で軽減）
- 開発環境でCSSを変更した場合、サーバー再起動が必要（起動時に1回だけ読み込むため）

## 検証方法

```bash
pnpm run build && pnpm run start
# DevTools > Network: main.css リクエストがなく <style> でインライン確認
# DevTools > Elements > <head>: <style data-main-css> に CSS が存在することを確認
# Lighthouse: "Eliminate render-blocking resources" に main.css が出ないことを確認
pnpm run test  # VRT
```
