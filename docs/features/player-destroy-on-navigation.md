# Player の画面遷移時 destroy 対応

## 概要

画面遷移（ページナビゲーション）によって Player コンポーネントがアンマウントされた際に、
HLS.js インスタンスと video 要素を確実に破棄する。

---

## 問題点

### 1. `videoElement` がアンマウント後も再生継続

**場所**: `workspaces/client/src/features/player/logics/create_player.ts`

従来の `destory()` は HLS.js の `destroy()` のみ呼んでいた:

```ts
destory(): void {
  this._player.destroy();  // HLS.js のみ
  // videoElement.pause() が呼ばれない
  // src も残ったまま
}
```

`hls.destroy()` は内部の detachMedia を行うが、video 要素自体は pause されないため、
DOM から取り外された後もブラウザがメディアセッションを保持し続ける。

### 2. `playlistUrl=""` で不要な HLS インスタンスが生成される

**場所**: `workspaces/client/src/features/recommended/components/JumbotronSection.tsx`

```tsx
playlistUrl={ inView ? `/streams/episode/${episode.id}/playlist.m3u8` : "" }
```

`inView=false` 状態でも `Player` コンポーネントはレンダリングされ、
`useEffect` が空 URL で HLS.js インスタンスを生成してしまっていた。

---

## 対応内容

### 1. `destory()` に video 要素のクリーンアップを追加

**ファイル**: `workspaces/client/src/features/player/logics/create_player.ts`

```ts
destory(): void {
  this.videoElement.pause();               // 再生を即停止
  this.videoElement.removeAttribute('src'); // メディアソース解放
  this.videoElement.load();               // リセット（ブラウザに解放を通知）
  this._player.destroy();                 // HLS.js 内部クリーンアップ
}
```

### 2. `Player` クリーンアップで `pause()` を先行呼び出し

**ファイル**: `workspaces/client/src/features/player/components/Player.tsx`

```ts
return () => {
  abortController.abort();
  if (player != null) {
    player.pause();                          // 追加: 即座に停止
    mountElement.removeChild(player.videoElement);
    player.destory();
  }
  assignRef(playerRef, null);
};
```

### 3. `playlistUrl` が空の場合は player を生成しない

**ファイル**: `workspaces/client/src/features/player/components/Player.tsx`

```ts
useEffect(() => {
  const mountElement = mountRef.current;
  invariant(mountElement);

  const abortController = new AbortController();
  let player: PlayerWrapper | null = null;

  if (!playlistUrl) return;   // 追加: 空 URL はスキップ

  void import('...').then(({ createPlayer }) => {
    // ...
  });
  // ...
}, [playerType, playlistUrl, loop]);
```

---

## 効果

| 問題 | 対応前 | 対応後 |
|------|--------|--------|
| ページ遷移後の音声継続 | 発生する可能性 | `pause()` で即停止 |
| メディアセッション保持 | HLS detach のみ | `src` 削除 + `load()` で完全解放 |
| 空 URL の HLS インスタンス | 生成される | `if (!playlistUrl) return` でスキップ |

- **JS ヒープ**: 不要な HLS.js インスタンスを削減
- **ネットワーク**: 空 URL への無駄なリクエストを防止
- **メディアリソース**: ナビゲーション時のリソースリーク解消

---

## 変更ファイル

- `workspaces/client/src/features/player/components/Player.tsx`
- `workspaces/client/src/features/player/logics/create_player.ts`
