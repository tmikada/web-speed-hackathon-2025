import { useEffect, useRef, useState } from 'react';

import { observeResize, unobserveResize } from '@wsh-2025/client/src/utils/sharedResizeObserver';

const MIN_WIDTH = 276;
const GAP = 12;

function calcWidth(el: HTMLDivElement): number {
  const styles = window.getComputedStyle(el);
  const innerWidth = el.clientWidth - parseInt(styles.paddingLeft) - parseInt(styles.paddingRight);
  const itemCount = Math.max(1, Math.floor((innerWidth + GAP) / (MIN_WIDTH + GAP)));
  return Math.floor((innerWidth + GAP) / itemCount - GAP);
}

// repeat(auto-fill, minmax(276px, 1fr)) を計算で求める
export function useCarouselItemWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MIN_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (el == null) return;

    // 初回計算
    setWidth(calcWidth(el));

    // リサイズ時のみ再計算
    observeResize(el, () => {
      setWidth(calcWidth(el));
    });
    return () => {
      unobserveResize(el);
    };
  }, []);

  return { ref: containerRef, width };
}
