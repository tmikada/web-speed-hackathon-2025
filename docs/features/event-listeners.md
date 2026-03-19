# JS イベントリスナー過多の調査 (7,733)

---

## 1. ~~Program 毎の Observer（最大の原因）~~ ✅ 対応済み

**場所**: `workspaces/client/src/pages/timetable/components/Program.tsx`

各 Program コンポーネントが**2つの Observer を個別に生成**していた:

- `IntersectionObserver` — 画像の遅延読み込み用
- `ResizeObserver` — タイトル/画像の高さチェック用

720 Program x 2 = **約1,440 Observer**

### 対応内容

共有 Observer ユーティリティを作成し、全 Program で Observer インスタンスを1つずつに集約。

**新規ファイル**:
- `workspaces/client/src/utils/sharedIntersectionObserver.ts`
- `workspaces/client/src/utils/sharedResizeObserver.ts`

**方針**:
- `Map<Element, Callback>` で要素ごとのコールバックを管理
- Observer は遅延初期化（`getObserver()`）— SSR 時にブラウザ API が存在しなくてもクラッシュしない
- `observe()` / `unobserve()` で個別要素の登録・解除が可能

**効果**: IntersectionObserver 720個 → 1個、ResizeObserver 720個 → 1個（リスナー約1,440削減）

## 2. ~~Program 毎の 250ms ポーリング~~ ✅ 対応済み

**場所**: `workspaces/client/src/pages/timetable/hooks/useCurrentUnixtimeMs.ts`

各 Program が個別に `setInterval(250ms)` を持っていた → **約720個の interval**

### 対応内容

`useCurrentUnixtimeMs` から `setInterval` を削除し、ストアの値を返すだけに変更。
interval は `TimetablePage` コンポーネントで1回だけ起動するようにした。

**変更ファイル**:
- `workspaces/client/src/pages/timetable/hooks/useCurrentUnixtimeMs.ts` — `useEffect` + `setInterval` を削除、ストアの購読のみに簡素化
- `workspaces/client/src/pages/timetable/components/TimetablePage.tsx` — ページルートで1回だけ `setInterval(250ms)` を起動

**Before（各 Program 内で720回実行）**:
```typescript
// useCurrentUnixtimeMs.ts
export function useCurrentUnixtimeMs(): number {
  const state = useStore((s) => s);
  useEffect(() => {
    const interval = setInterval(() => {
      state.pages.timetable.refreshCurrentUnixtimeMs();
    }, 250);
    return () => clearInterval(interval);
  }, []);
  return state.pages.timetable.currentUnixtimeMs;
}
```

**After（フックは値を返すだけ、interval は TimetablePage で1回）**:
```typescript
// useCurrentUnixtimeMs.ts
export function useCurrentUnixtimeMs(): number {
  return useStore((s) => s.pages.timetable.currentUnixtimeMs);
}

// TimetablePage.tsx
useEffect(() => {
  const interval = setInterval(() => {
    state.pages.timetable.refreshCurrentUnixtimeMs();
  }, 250);
  return () => clearInterval(interval);
}, []);
```

**効果**: `setInterval` が720個 → 1個（約719個削減）

## 3. ~~カルーセルの 250ms ポーリング~~ ✅ 対応済み

**場所**: `workspaces/client/src/features/recommended/hooks/useCarouselItemWidth.ts`

カルーセル毎に `setInterval(250ms)` + `forceUpdate()` で無条件に再レンダリングしていた。

### 対応内容

`setInterval` + `useUpdate`（forceUpdate）を廃止し、共有 `sharedResizeObserver` でコンテナのリサイズ時のみ幅を再計算するように変更。

**変更ファイル**:
- `workspaces/client/src/features/recommended/hooks/useCarouselItemWidth.ts` — `setInterval` + `useUpdate` を削除、`useState` + `observeResize` に置き換え

**Before（250ms毎に無条件 forceUpdate）**:
```typescript
import { useUpdate } from 'react-use';

export function useCarouselItemWidth() {
  const forceUpdate = useUpdate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(function tick() {
      forceUpdate();
    }, 250);
    return () => clearInterval(interval);
  }, []);
  // ... レンダリング毎に幅を再計算
}
```

**After（リサイズ時のみ再計算）**:
```typescript
import { observeResize, unobserveResize } from '@wsh-2025/client/src/utils/sharedResizeObserver';

export function useCarouselItemWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (el == null) return;
    setWidth(calcWidth(el));
    observeResize(el, () => setWidth(calcWidth(el)));
    return () => unobserveResize(el);
  }, []);

  return { ref: containerRef, width };
}
```

**効果**: `setInterval` 削除、不要な再レンダリング防止、`react-use` の `useUpdate` 依存を解消

## 4. ~~番組ページの再帰 setTimeout~~ ✅ 対応済み

**場所**: `workspaces/client/src/pages/program/components/ProgramPage.tsx`

`useUpdate()` (forceUpdate) + 再帰 `setTimeout(250ms)` で、放送状態を250msごとにポーリングしていた。2つのケースがある:

1. **放送前** — 放送開始時刻になるまで250msごとに `forceUpdate()` → `DateTime.now()` との比較が再評価される
2. **放送中** — 放送終了時刻まで250msごとにチェックし、終了したら次の番組にナビゲート

### 対応内容

`useUpdate` + `useRef` + 再帰 `setTimeout(250ms)` を廃止し、`useState` + 時刻指定 `setTimeout` 1回に変更。

**変更ファイル**:
- `workspaces/client/src/pages/program/components/ProgramPage.tsx` — `useUpdate`/`useRef` を削除、`useState` + 時刻計算による `setTimeout` に置き換え

**Before（250msごとに再帰ポーリング）**:
```typescript
const forceUpdate = useUpdate();
const isArchivedRef = useRef(DateTime.fromISO(program.endAt) <= DateTime.now());
const isBroadcastStarted = DateTime.fromISO(program.startAt) <= DateTime.now();

// 放送前: 250msごとに forceUpdate
if (!isBroadcastStarted) {
  let timeout = setTimeout(function tick() {
    forceUpdate();
    timeout = setTimeout(tick, 250);
  }, 250);
}

// 放送中: 250msごとに終了チェック
let timeout = setTimeout(function tick() {
  if (DateTime.now() < DateTime.fromISO(program.endAt)) {
    timeout = setTimeout(tick, 250);
    return;
  }
  // navigate or forceUpdate
}, 250);
```

**After（時刻指定で1回だけ発火）**:
```typescript
const [isArchived, setIsArchived] = useState(() => DateTime.fromISO(program.endAt) <= DateTime.now());
const [isBroadcastStarted, setIsBroadcastStarted] = useState(() => DateTime.fromISO(program.startAt) <= DateTime.now());

// 放送前 → 開始時刻ちょうどに1回だけ発火
if (!isBroadcastStarted) {
  const msUntilStart = DateTime.fromISO(program.startAt).diff(DateTime.now()).milliseconds;
  const timeout = setTimeout(() => setIsBroadcastStarted(true), Math.max(0, msUntilStart));
}

// 放送中 → 終了時刻ちょうどに1回だけ発火
const msUntilEnd = DateTime.fromISO(program.endAt).diff(DateTime.now()).milliseconds;
const timeout = setTimeout(() => { /* navigate or setIsArchived */ }, Math.max(0, msUntilEnd));
```

**効果**: 250msポーリング → 必要なタイミングで1回だけ実行。`useUpdate`・`useRef` 依存を解消。

## 5. ~~プレイヤー状態の 250ms ポーリング~~ ✅ 対応済み

**場所**: `workspaces/client/src/pages/episode/stores/createEpisodePageStoreSlice.ts`

`currentTime` と `duration` を250msごとに `setInterval` でポーリングしていた。

### 対応内容

`setInterval` を廃止し、HTMLVideoElement のメディアイベントに置き換え。

**変更ファイル**:
- `workspaces/client/src/pages/episode/stores/createEpisodePageStoreSlice.ts` — `setInterval` を削除、`timeupdate` / `loadedmetadata` / `durationchange` イベントに置き換え

**Before（250msごとにポーリング）**:
```typescript
const interval = setInterval(function tick() {
  set(() => ({
    currentTime: player.currentTime,
    duration: player.duration,
  }));
}, 250);
abortController.signal.addEventListener('abort', () => {
  clearInterval(interval);
});
```

**After（メディアイベント駆動）**:
```typescript
player.videoElement.addEventListener('timeupdate', () => {
  set({ currentTime: player.currentTime });
}, { signal: abortController.signal });

player.videoElement.addEventListener('loadedmetadata', () => {
  set({ duration: player.duration });
}, { signal: abortController.signal });

player.videoElement.addEventListener('durationchange', () => {
  set({ duration: player.duration });
}, { signal: abortController.signal });
```

**効果**: `setInterval` 削除、ブラウザネイティブのイベント駆動に。`timeupdate` は通常250ms前後の間隔で発火するので動作はほぼ同等だが、不要なストア更新が減る。

---

## 改善案

| 優先度 | 対策 | 効果 | 状態 |
|--------|------|------|------|
| 1 | Observer の共有化（720個 → 1個） | リスナー ~1,440 削減 | ✅ 完了 |
| 2 | useCurrentUnixtimeMs をアプリ全体で1つに | interval ~720 削減 | ✅ 完了 |
| 3 | カルーセルのポーリング廃止 → ResizeObserver | 不要な再レンダリング防止 | ✅ 完了 |
| 4 | 番組ページのポーリング廃止 → 時刻指定 setTimeout | ポーリング不要化 | ✅ 完了 |
| 5 | プレイヤー状態を media イベント駆動に | ポーリング不要化 | ✅ 完了 |
