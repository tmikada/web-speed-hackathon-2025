import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { ArrayValues } from 'type-fest';

import { CarouselSection } from '@wsh-2025/client/src/features/recommended/components/CarouselSection';
import { JumbotronSection } from '@wsh-2025/client/src/features/recommended/components/JumbotronSection';
import { RecommendedSection } from '@wsh-2025/client/src/features/recommended/components/RecommendedSection';
import { useRecommended } from '@wsh-2025/client/src/features/recommended/hooks/useRecommended';

// export const prefetch = async (store: ReturnType<typeof createStore>) => {
//   const modules = await store
//     .getState()
//     .features.recommended.fetchRecommendedModulesByReferenceId({ referenceId: 'entrance' });
//   return { modules };
// };
interface Props {
  // id: string;
  module: ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>;
}

export const RecommendedSection = ({ module }: Props) => {
  // const module = useRecommended({ referenceId: id });

  if (module.type === 'jumbotron') {
    return <JumbotronSection id={module.items[0]?.episode.id} } />;
  } else {
    return <CarouselSection id={module.id}  />;
  }
};
