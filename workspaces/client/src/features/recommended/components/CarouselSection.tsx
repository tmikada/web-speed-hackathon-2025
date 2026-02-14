import { ElementScrollRestoration } from '@epic-web/restore-scroll';
import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { ArrayValues } from 'type-fest';
import { useMergeRefs } from 'use-callback-ref';

import { EpisodeItem } from '@wsh-2025/client/src/features/recommended/components/EpisodeItem';
import { SeriesItem } from '@wsh-2025/client/src/features/recommended/components/SeriesItem';
import { useCarouselItemWidth } from '@wsh-2025/client/src/features/recommended/hooks/useCarouselItemWidth';
import { useScrollSnap } from '@wsh-2025/client/src/features/recommended/hooks/useScrollSnap';
import { observe, unobserve } from '@wsh-2025/client/src/utils/sharedIntersectionObserver';

interface Props {
  module: ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>;
}

interface LazyItemProps {
  item: ArrayValues<ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>['items']>;
  width: number;
}

const LazyCarouselItem = ({ item, width }: LazyItemProps): ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    observe(el, (entry) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        unobserve(el);
      }
    });

    return () => {
      unobserve(el);
    };
  }, []);

  return (
    <div ref={ref} className="shrink-0 grow-0" style={{ width: `${width}px` }}>
      {isInView ? (
        <>
          {item.series != null ? <SeriesItem series={item.series} /> : null}
          {item.episode != null ? <EpisodeItem episode={item.episode} /> : null}
        </>
      ) : null}
    </div>
  );
};

export const CarouselSection = ({ module }: Props) => {
  const containerRefForScrollSnap = useScrollSnap({ scrollPadding: 24 });
  const { ref: containerRefForItemWidth, width: itemWidth } = useCarouselItemWidth();
  const mergedRef = useMergeRefs([containerRefForItemWidth, containerRefForScrollSnap]);

  return (
    <>
      <div className="w-full">
        <h2 className="mb-[16px] w-full text-[22px] font-bold">{module.title}</h2>
        <div
          key={module.id}
          ref={mergedRef}
          className={`relative mx-[-24px] flex flex-row gap-x-[12px] overflow-x-auto overflow-y-hidden pl-[24px] pr-[56px]`}
          data-scroll-restore={`carousel-${module.id}`}
        >
          {module.items.map((item) => (
            <LazyCarouselItem key={item.id} item={item} width={itemWidth} />
          ))}
        </div>
      </div>

      <ElementScrollRestoration direction="horizontal" elementQuery={`[data-scroll-restore="carousel-${module.id}"]`} />
    </>
  );
};
