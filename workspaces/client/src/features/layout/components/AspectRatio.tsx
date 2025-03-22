import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
  onInView?: () => void;
  ratioHeight: number;
  ratioWidth: number;
}

export const AspectRatio = ({ children, ratioHeight, ratioWidth, onInView }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !onInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isInView) {
          setIsInView(true);
          onInView();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [onInView, isInView]);

  const height = (width * ratioHeight) / ratioWidth;

  return (
    <div ref={containerRef} className={`h-[${height}px] relative w-full`}>
      {children}
    </div>
  );
};
