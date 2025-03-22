import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { useState } from 'react';
import Ellipsis from 'react-ellipsis-component';
import { Flipped } from 'react-flip-toolkit';
import { NavLink } from 'react-router-dom';
import { type ArrayValues } from 'type-fest';

import { OptimizedImage } from '@wsh-2025/client/src/features/image/components/OptimizedImage';
import { AspectRatio } from '@wsh-2025/client/src/features/layout/components/AspectRatio';
import { Hoverable } from '@wsh-2025/client/src/features/layout/components/Hoverable';

type Episode = ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>['items'][number];

interface Props {
  episode: Episode;
}

export const EpisodeItem = ({ episode }: Props) => {
  const [showThumbnail, setShowThumbnail] = useState(false);

  if (!episode.series) {
    return null;
  }

  const { series } = episode;

  return (
    <Hoverable classNames={{ hovered: 'opacity-75' }}>
      <NavLink className="block w-full overflow-hidden" to={`/episodes/${episode.id}`}>
        {({ isTransitioning }) => {
          return (
            <>
              <Flipped flipId={isTransitioning ? `episode-${episode.id}` : 0}>
                <div className="relative overflow-hidden rounded-[8px] border-[2px] border-solid border-[#FFFFFF1F]">
                  <AspectRatio 
                    ratioHeight={9} 
                    ratioWidth={16}
                    onInView={() => {
                      setShowThumbnail(true);
                    }}
                  >
                    <div className="relative size-full">
                      {showThumbnail && (
                        <OptimizedImage
                          alt={series.title}
                          className="h-auto w-full"
                          height={720}
                          priority={false}
                          src={series.thumbnailUrl}
                          width={1280}
                        />
                      )}
                    </div>
                  </AspectRatio>
                  <span className="i-material-symbols:play-arrow-rounded absolute bottom-[4px] left-[4px] m-[4px] block size-[20px] text-[#ffffff]" />
                  {series.episodes.some((ep) => ep.premium) ? (
                    <span className="absolute bottom-[8px] right-[4px] inline-flex items-center justify-center rounded-[4px] bg-[#1c43d1] p-[4px] text-[10px] text-[#ffffff]">
                      プレミアム
                    </span>
                  ) : null}
                </div>
              </Flipped>
              <div className="p-[8px]">
                <div className="text-[14px] font-bold text-[#ffffff]">
                  <Ellipsis ellipsis reflowOnResize maxLine={2} text={series.title} visibleLine={2} />
                </div>
              </div>
            </>
          );
        }}
      </NavLink>
    </Hoverable>
  );
};
