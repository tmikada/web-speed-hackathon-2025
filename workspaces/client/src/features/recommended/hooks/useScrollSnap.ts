import { useEffect, useRef } from 'react';

export function useScrollSnap({ scrollPadding }: { scrollPadding: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const isSnapping = useRef(false);

  useEffect(() => {
    if (containerRef.current == null) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      isScrolling.current = true;
    };

    const handleScrollend = () => {
      isScrolling.current = false;

      if (isSnapping.current || !containerRef.current) {
        return;
      }

      const childElements = Array.from(containerRef.current.children) as HTMLElement[];
      const childScrollPositions = childElements.map((element) => element.offsetLeft);
      const scrollPosition = containerRef.current.scrollLeft;
      const childIndex = childScrollPositions.reduce((prev, curr, index) => {
        return Math.abs(curr - scrollPosition) < Math.abs((childScrollPositions[prev] ?? 0) - scrollPosition)
          ? index
          : prev;
      }, 0);

      isSnapping.current = true;
      containerRef.current.scrollTo({
        behavior: 'smooth',
        left: (childScrollPositions[childIndex] ?? 0) - scrollPadding,
      });

      timer = setTimeout(() => {
        isSnapping.current = false;
      }, 1000);
    };

    containerRef.current.addEventListener('scroll', handleScroll);
    containerRef.current.addEventListener('scrollend', handleScrollend);

    return () => {
      containerRef.current?.removeEventListener('scroll', handleScroll);
      containerRef.current?.removeEventListener('scrollend', handleScrollend);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return containerRef;
}
