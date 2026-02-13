import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
  ratioHeight: number;
  ratioWidth: number;
}

export const AspectRatio = ({ children, ratioHeight, ratioWidth }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const height = (width * ratioHeight) / ratioWidth;

  return (
    <div ref={containerRef} className={`h-[${height}px] relative w-full`}>
      {children}
    </div>
  );
};
