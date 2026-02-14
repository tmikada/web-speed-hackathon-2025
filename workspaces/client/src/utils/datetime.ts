const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJSTComponents(d: Date) {
  const jst = new Date(d.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
    second: jst.getUTCSeconds(),
  };
}

export function startOfDayJST(d: Date = new Date()): Date {
  const c = toJSTComponents(d);
  return new Date(Date.UTC(c.year, c.month - 1, c.day) - JST_OFFSET_MS);
}

export function endOfDayJST(d: Date = new Date()): Date {
  const c = toJSTComponents(d);
  return new Date(Date.UTC(c.year, c.month - 1, c.day, 23, 59, 59, 999) - JST_OFFSET_MS);
}

export function formatDateTimeJST(iso: string, fmt: 'L月d日 H:mm' | 'mm'): string {
  const c = toJSTComponents(new Date(iso));
  const pad2 = (n: number) => String(n).padStart(2, '0');

  switch (fmt) {
    case 'L月d日 H:mm':
      return `${c.month}月${c.day}日 ${c.hour}:${pad2(c.minute)}`;
    case 'mm':
      return pad2(c.minute);
  }
}

export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
