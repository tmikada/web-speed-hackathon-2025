# SSR Streaming 実装方針

## 現状の問題点

[workspaces/server/src/ssr.tsx](../workspaces/server/src/ssr.tsx) の現状：

1. `renderToString()` を呼んでいるが **結果を破棄** している（41-47行目）
2. `<body></body>` が **空のまま** クライアントに送信されている（59行目）
3. Zustand ストアの hydration データが渡されていない
4. `renderToString` は **同期的** でレスポンス開始が遅い（全レンダリング完了まで待つ）

## 方針: `renderToPipeableStream` を使ったストリーミング SSR

### なぜ `renderToPipeableStream` か

| 比較項目 | `renderToString` | `renderToPipeableStream` |
|---------|------------------|--------------------------|
| レスポンス開始 | 全レンダリング完了後 | シェル完了時（`onShellReady`） |
| Suspense対応 | 非対応（fallback表示のみ） | 対応（後からストリームで注入） |
| TTFB | 遅い | 速い |
| メモリ | 全HTMLを文字列として保持 | ストリーミングで逐次送信 |

### API概要

```tsx
import { renderToPipeableStream } from 'react-dom/server';

const { pipe } = renderToPipeableStream(<App />, {
  bootstrapScripts: ['/main.js'],
  onShellReady() {
    // シェル（Suspense外の部分）のレンダリング完了
    // ここでレスポンス開始 → TTFB短縮
    response.setHeader('content-type', 'text/html');
    pipe(response);
  },
  onShellError(error) {
    // シェルのレンダリング失敗 → フォールバックHTML返却
  },
  onAllReady() {
    // 全レンダリング完了（Suspense含む）
    // クローラー向けに使う場合はここで pipe
  },
  onError(error) {
    // レンダリング中のエラー
  }
});
```

## 実装変更箇所

### 1. サーバー側: `workspaces/server/src/ssr.tsx`

#### Before（元コード）
```tsx
import { renderToString } from 'react-dom/server';

// renderToString の結果を捨てている
renderToString(
  <StrictMode>
    <StoreProvider createStore={() => store}>
      <StaticRouterProvider context={context} hydrate={false} router={router} />
    </StoreProvider>
  </StrictMode>,
);

// 空のHTMLを送信
reply.type('text/html').send(`
  <!DOCTYPE html>
  <html lang="ja">
    <head>...</head>
    <body></body>
  </html>
  <script>window.__staticRouterHydrationData = ...</script>
`);
```

#### After（実装済み）
```tsx
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';

const { pipe } = renderToPipeableStream(
  <StrictMode>
    <StoreProvider createStore={() => store}>
      <StaticRouterProvider context={context} hydrate={true} router={router} />
    </StoreProvider>
  </StrictMode>,
  {
    onShellReady() {
      // PassThrough を介して Fastify の reply.send() 経由で返す
      // → @fastify/compress, onSend フック等が正常に動作する
      const passthrough = new PassThrough();
      reply.type('text/html').send(passthrough);
      pipe(passthrough);
    },
    onShellError() {
      // フォールバック: 空HTMLを返してCSRにフォールバック
      reply.status(500).type('text/html').send(`
        <!DOCTYPE html>
        <html lang="ja">
          <head><script src="/public/main.js"></script></head>
          <body></body>
        </html>
      `);
    },
    onError(error) {
      console.error('SSR streaming error:', error);
    },
  }
);
```

#### ポイント
- **`PassThrough` ストリーム経由で `reply.send()`**: `reply.raw` に直接 pipe すると Fastify のレスポンスライフサイクル（`@fastify/compress`, `onSend` フック等）がバイパスされる。`PassThrough` を介して `reply.send()` に渡すことで、圧縮・ヘッダー設定が正常に動作する
- **`hydrate={true}`** に変更: `StaticRouterProvider` の `hydrate` を true にして、hydration 用のインラインスクリプトを自動挿入させる
- **`bootstrapScripts` は不要**: `Document` コンポーネントが既に `<script src="/public/main.js">` を含んでいるため

### 2. Hydration データの注入

#### Router hydration データ
`StaticRouterProvider` に `hydrate={true}` を渡すと、react-router が自動的に `window.__staticRouterHydrationData` を設定するインラインスクリプトを挿入する。現状の手動スクリプト注入は不要になる。

#### Zustand ストアの hydration データ
SSR 中にローダーが fetch したデータは Zustand ストアに格納される。クライアント側で再 fetch を避けるために、ストアの状態をシリアライズして渡す。

```tsx
// ssr.tsx 内：renderToPipeableStream の前にストアの状態を取得する準備
// → Document コンポーネント内でインラインスクリプトとして埋め込む案
//    または onShellReady 後に追加スクリプトを書き込む案
```

**方法A**: `Document` コンポーネントに hydration スクリプトを含める（Reactツリー内）
**方法B**: ストリーム完了後に手動でスクリプトを `reply.raw.write()` する

→ 方法Aが望ましい（React のハイドレーションと整合性が取れるため）

### 3. クライアント側: `workspaces/client/src/main.tsx`（実装済み）

```tsx
// Before
const store = createStore({});
const router = createBrowserRouter(createRoutes(store), {});

// After: hydration データを使う
const store = createStore({ hydrationData: window.__zustandHydrationData });
const router = createBrowserRouter(
  createRoutes(store),
  {
    hydrationData: window.__staticRouterHydrationData,
  }
);
```

### 4. Document コンポーネント: `workspaces/client/src/app/Document.tsx`（実装済み）

CSS の `<link>` タグを追加（元の SSR テンプレートにはあったが Document にはなかった）。

```tsx
<head>
  <meta charSet="UTF-8" />
  <meta content="width=device-width, initial-scale=1.0" name="viewport" />
  <link rel="stylesheet" href="/public/main.css" />
  <script src="/public/main.js"></script>
</head>
```

## 注意点・リスク

### 1. lazy() ルートとの整合性
現在ルートは `lazy()` で定義されている。`createStaticHandler` はサーバー側で lazy を解決するが、クライアント側 hydration 時にも同じチャンクが必要。チャンクが未ロードだと hydration mismatch が発生する可能性がある。

**対策**: ルートごとの JS チャンクを `<link rel="modulepreload">` でプリロードするか、クリティカルなルートは lazy() を外す。

### 1.1. `HydrateFallback` の設定（対応済み）
`lazy()` を使ったルートで SSR hydration を行うと、クライアント側でコンポーネントがまだ読み込まれていない間に React Router が警告を出す:
```
No `HydrateFallback` element provided to render during initial hydration
```

**対策**: 各 `lazy()` ルートの返り値に `HydrateFallback: () => null` を追加。`null` を返すことで、サーバーで描画済みの HTML がそのまま保持され、lazy コンポーネント読み込み完了後に hydration が完了する。

```tsx
// createRoutes.tsx 内の各 lazy() ルート
async lazy() {
  const { HomePage, prefetch } = await import('...');
  return {
    Component: HomePage,
    HydrateFallback: () => null,  // SSR HTMLを維持
    async loader() { ... },
  };
},
```

### 2. `@fastify/compress` との互換性
`PassThrough` ストリーム経由で `reply.send()` するため、`@fastify/compress` のストリーミング圧縮が正常に動作する。（`reply.raw` 直接 pipe の場合はバイパスされるため不採用とした）

### 3. VRT への影響
SSR で初期HTMLが変わるため、VRT が失敗する可能性がある。レイアウト自体は変わらないはずだが、hydration mismatch があるとちらつきが発生しうる。

## 期待される効果

| メトリクス | 改善理由 |
|-----------|---------|
| LCP | 初期HTMLにコンテンツが含まれるため、JSロード完了を待たずに表示 |
| CLS | SSR済みHTMLがあるためレイアウトシフトが減少 |
| TBT | hydration は必要だがレンダリング作業が軽減 |
| TTFB | `onShellReady` でシェル完了時に即レスポンス開始 |
