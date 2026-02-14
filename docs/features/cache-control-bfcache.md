# Cache-Control改善: bfcache有効化

## 概要

全レスポンスに `Cache-Control: no-store` が設定されており、ブラウザのbfcache（Back/Forward Cache）が無効化されている。
Lighthouseで「ページでバックフォワード キャッシュの復元が妨げられました」として検出される。

---

## 現状の問題

**該当ファイル**: `workspaces/server/src/index.ts:23-31`

```ts
app.addHook('onSend', async (_req, reply, payload) => {
  if (_req.url.match(/\/streams\/.*\.ts$/)) {
    reply.header('cache-control', 'public, max-age=31536000, immutable');
  }
  else {
    reply.header('cache-control', 'no-store');
  }
  return payload;
});
```

- HLSストリーム(`.ts`)以外の**全リクエスト**に `no-store` が適用される
- HTMLページ、API、静的ファイル(JS/CSS/画像/フォント)すべてが対象
- `no-store` はブラウザにキャッシュ保存自体を禁止するため、bfcacheも無効になる

### Lighthouse検出内容

| 失敗の理由 | 種類 |
|-----------|------|
| Cache-Control: no-store のメインリソースがあるページは、bfcacheに保存できません | 対応不可 |
| 一部のJSネットワークリクエストでno-storeヘッダーを含むリソースが返された | 対応不可 |

---

## no-store と no-cache の違い

| ヘッダー | キャッシュ保存 | 再利用時の動作 | bfcache |
|---------|-------------|-------------|---------|
| `no-store` | 禁止 | 毎回サーバーから取得 | **無効** |
| `no-cache` | 許可 | 使う前にサーバーに再検証 | **有効** |

`no-cache` はキャッシュを保存するが、使う前に必ずサーバーに問い合わせる（304 Not Modified で高速応答可能）。
データの鮮度を保ちつつ、bfcacheの恩恵を受けられる。

---

## 修正方針

`onSend` フックのキャッシュ戦略を、リソースの種類に応じて分岐させる。

### キャッシュ戦略

| リソース | パターン | Cache-Control | 理由 |
|---------|---------|---------------|------|
| HLSセグメント | `/streams/*.ts` | `public, max-age=31536000, immutable` | 変更されないバイナリ（現状維持） |
| 静的ファイル | `/public/*` | `public, max-age=31536000, immutable` | ハッシュ付きビルド成果物、変更時はURLが変わる |
| APIレスポンス | `/api/*` | `no-cache` | データの鮮度が必要だがbfcacheは有効にしたい |
| HTMLページ(SSR) | `/*`（上記以外） | `no-cache` | 最新コンテンツを返しつつbfcacheを有効化 |

### 修正コード

```ts
// workspaces/server/src/index.ts
app.addHook('onSend', async (_req, reply, payload) => {
  if (_req.url.match(/\/streams\/.*\.ts$/) || _req.url.startsWith('/public/')) {
    reply.header('cache-control', 'public, max-age=31536000, immutable');
  } else {
    reply.header('cache-control', 'no-cache');
  }
  return payload;
});
```

---

## 期待される効果

- **bfcache有効化**: ブラウザの戻る/進むでページが即座に復元される
- **静的ファイルのキャッシュ**: JS/CSS/フォント/画像が長期キャッシュされ、2回目以降のロードが高速化
- **Lighthouse監査パス**: bfcache関連の警告が解消される

---

## 影響範囲

| 対象 | 変更内容 | リスク |
|------|---------|-------|
| HTMLページ | `no-store` → `no-cache` | 低（再検証で常に最新を返す） |
| APIレスポンス | `no-store` → `no-cache` | 低（同上） |
| 静的ファイル | `no-store` → `immutable` | 低（ハッシュ付きURLなので安全） |

## VRTリスク

**なし** — キャッシュヘッダーの変更のみで、レスポンス内容・表示には影響しない。修正後にVRT実行で確認。
