import { ReactElement, useEffect, useRef, useState } from 'react';
import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { ArrayValues } from 'type-fest';

import { createStore } from '@wsh-2025/client/src/app/createStore';
import { RecommendedSection } from '@wsh-2025/client/src/features/recommended/components/RecommendedSection';
import { useRecommended } from '@wsh-2025/client/src/features/recommended/hooks/useRecommended';
import { observe, unobserve } from '@wsh-2025/client/src/utils/sharedIntersectionObserver';

export const prefetch = async (store: ReturnType<typeof createStore>) => {
  const modules = await store
    .getState()
    .features.recommended.fetchRecommendedModulesByReferenceId({ referenceId: 'entrance' });
  return { modules };
};

interface LazyModuleProps {
  module: ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>;
}

const LazyModule = ({ module }: LazyModuleProps): ReactElement => {
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = placeholderRef.current;
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

  if (!isInView) {
    return (
      <div ref={placeholderRef} className="mb-[24px] px-[24px]" style={{ minHeight: '280px' }} />
    );
  }

  return (
    <div className="mb-[24px] px-[24px]">
      <RecommendedSection module={module} />
    </div>
  );
};

export const HomePage = () => {
  const modules = useRecommended({ referenceId: 'entrance' });

  return (
    <>
      <title>Home - AremaTV</title>

      <div className="w-full py-[48px]">
        {modules.map((module) => {
          return <LazyModule key={module.id} module={module} />;
        })}
      </div>
    </>
  );
};
