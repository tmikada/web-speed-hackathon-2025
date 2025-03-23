import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { useState } from 'react';
import { Flipped } from 'react-flip-toolkit';
import { NavLink } from 'react-router-dom';

import { OptimizedImage } from '@wsh-2025/client/src/features/image/components/OptimizedImage';
import { AspectRatio } from '@wsh-2025/client/src/features/layout/components/AspectRatio';
import { Hoverable } from '@wsh-2025/client/src/features/layout/components/Hoverable';

type RecommendedModuleResponse = StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>;
type RecommendedItem = RecommendedModuleResponse[number]['items'][number];
type Episode = NonNullable<RecommendedItem['episode']>;

interface Props {
  id: string;
  seriesThumbnailUrl: string;
  episodeTitle: string;
  seriesTitle: string;
  premium: boolean;
  index?: number;
}

export const EpisodeItem = ({ id, seriesThumbnailUrl, episodeTitle, seriesTitle, premium, index = 0 }: Props) => {
  const [showThumbnail, setShowThumbnail] = useState(false);
  const isFirstRow = index < 4;

  // if (!episode.series) {
  //   return null;
  // }

  // const { series } = episode;

  return (
    <Hoverable classNames={{ hovered: 'opacity-75' }}>
      <NavLink className="block w-full overflow-hidden" to={`/episodes/${id}`}>
        {({ isTransitioning }) => {
          return (
            <>
              <Flipped flipId={isTransitioning ? `episode-${id}` : 0}>
                <div className="relative overflow-hidden rounded-[8px] border-[2px] border-solid border-[#FFFFFF1F]">
                  <AspectRatio 
                    ratioHeight={9} 
                    ratioWidth={16}
                    onInView={() => {
                      setShowThumbnail(true);
                    }}
                  >
                    <div className="relative size-full bg-[#1a1a1a]">
                      <OptimizedImage
                        alt={seriesTitle}
                        className="h-auto w-full"
                        height={158}
                        loading={isFirstRow ? 'eager' : 'lazy'}
                        priority={isFirstRow}
                        src={showThumbnail ? seriesThumbnailUrl : '/images/037.webp'}
                        width={280}
                      />
                    </div>
                  </AspectRatio>
                  <span className="i-material-symbols:play-arrow-rounded absolute bottom-[4px] left-[4px] m-[4px] block size-[20px] text-[#ffffff]" />
                  {premium ? (
                    <span className="absolute bottom-[8px] right-[4px] inline-flex items-center justify-center rounded-[4px] bg-[#1c43d1] p-[4px] text-[10px] text-[#ffffff]">
                      プレミアム
                    </span>
                  ) : null}
                </div>
              </Flipped>
              <div className="h-[88px] w-full p-[8px]">
                <h3 className="mb-[4px] text-[14px] font-bold text-[#ffffff] line-clamp-2 overflow-hidden text-ellipsis">
                  {episodeTitle}
                </h3>
                <div className="text-[12px] text-[#999999] line-clamp-2 overflow-hidden text-ellipsis">
                  {seriesTitle}
                </div>
              </div>
            </>
          );
        }}
      </NavLink>
    </Hoverable>
  );
};
