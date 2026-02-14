import { useStore } from '@wsh-2025/client/src/app/StoreContext';

export function useCurrentUnixtimeMs(): number {
  return useStore((s) => s.pages.timetable.currentUnixtimeMs);
}
