# ログインボタンのhydration遅延問題と対策

## 問題

ホームページ表示後、**chunkのJSが読み込まれるまでログインボタンを押してもダイアログが開かない**。

採点ツール (`calculate_user_auth_flow_action.ts`) がログインボタンをクリックする時点でReactのhydrationが未完了の場合、INP・TBTに悪影響を及ぼす。

## 根本原因

### hydrationフロー（修正前）

```
main.js 実行 (DOMContentLoaded)
  → createBrowserRouter() 作成
  → hydrateRoot() 開始
    → RouterProvider がルートマッチを解決
    → 子ルート (HomePage) が async lazy() → import() でchunk fetchを開始
    → チャンクDL中: React Router は "loading" 状態
    → HydrateFallback: () => null → ルート全体が null レンダリング
    → Layout のonClickハンドラが未登録 ← ログインボタンが無効
  → チャンク DL 完了
  → hydration 完了
  → ログインボタン有効 ✓
```

### なぜ Suspense 境界の変更では解決できなかったか

`Document.tsx` の `<Suspense>` を `<Layout>` の外から内側に移動したが効果なし（試行済み）。

原因: React の Suspense 境界の問題ではなく、**React Router 7 の `RouterProvider` が lazy チャンクの解決まで全ルートの描画をブロックする**設計のため。`HydrateFallback: () => null` の動作により、子ルートのlazy解決前はDocument全体がnullになる。

## 対策

### 1. ホームページルートをeager importに変更（対応済み）

**ファイル**: [workspaces/client/src/app/createRoutes.tsx](../../workspaces/client/src/app/createRoutes.tsx)

**変更前**: `async lazy()` でdynamic import
```tsx
{
  index: true,
  async lazy() {
    const { HomePage, prefetch } = await import('...HomePage');
    return {
      Component: HomePage,
      HydrateFallback: () => null,
      async loader() { ... },
    };
  },
},
```

**変更後**: static importで直接Component指定
```tsx
// ファイル先頭
import { HomePage, homePagePrefetch } from '@wsh-2025/client/src/pages/home/components/HomePage';

// ルート定義
{
  index: true,
  Component: HomePage,
  async loader() {
    if (typeof window === 'undefined') return {};
    return await homePagePrefetch(store);
  },
},
```

**効果**:
- `RouterProvider` がlazy待ちにならない
- `hydrateRoot` 実行直後にLayoutのイベントハンドラが登録される
- ログインボタンがmain.jsロード完了直後から有効 ✓

**トレードオフ**:
- main.jsのサイズが増加（HomePage + 依存コンポーネント分）
- ただしHomePage表示時は同コードが必要なため、総ダウンロード量は変わらない
- チャンクへのシーケンシャルなリクエストが不要になりむしろ高速

### 2. Suspense境界の変更（補助的効果・対応済み）

**ファイル**: [workspaces/client/src/app/Document.tsx](../../workspaces/client/src/app/Document.tsx)

`<Suspense>` を `<Layout>` の外から内側（`<Outlet>` のみを囲む形）に移動。

```tsx
// 変更後
<body>
  <Layout>
    <Suspense>
      <Outlet />
    </Suspense>
  </Layout>
</body>
```

この変更単独では hydration 問題を解決しないが、SSRストリーミング時にLayoutが先にシェルに含まれるため維持する。

## 今後の対応（未実装）

他のページ（episode, series, program, timetable）も同様の問題があるが、採点テストのシナリオではホームページからの遷移後に操作するため影響は小さい。

必要に応じて以下を検討:
- 全ルートをeager importにする（main.jsサイズ増大を許容）
- chunkを `<link rel="preload" as="script">` でSSR時にプリロードする

## 期待される効果

| 指標 | 改善内容 |
|------|---------|
| INP (Interaction to Next Paint) | ログインボタンクリックへの応答が即時に |
| TBT | ユーザー認証フローのTotal Blocking Time削減 |
| 採点「ページの操作」| ユーザー認証シナリオのスコア改善 |
