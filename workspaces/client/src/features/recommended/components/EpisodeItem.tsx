import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { memo, useState } from 'react';
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

const EpisodeContent = memo(({ episode, showThumbnail, isTransitioning }: Props & { showThumbnail: boolean; isTransitioning: boolean }) => {
  const { series } = episode;

  return (
    <>
      <Flipped flipId={isTransitioning ? `episode-${episode.id}` : 0}>
        <div className="relative h-[158px] overflow-hidden rounded-[8px] border-[2px] border-solid border-[#FFFFFF1F]">
          <AspectRatio 
            ratioHeight={9} 
            ratioWidth={16}
          >
            <div className="relative size-full">
              {showThumbnail && (
                <OptimizedImage
                  alt={series.title}
                  className="size-full object-cover"
                  height={158}
                  priority={false}
                  src={series.thumbnailUrl}
                  width={280}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              )}
            </div>
          </AspectRatio>
          <span className="i-material-symbols:play-arrow-rounded absolute bottom-[4px] left-[4px] m-[4px] block size-[20px] text-[#ffffff]" />
          {episode.premium ? (
            <span className="absolute bottom-[8px] right-[4px] inline-flex items-center justify-center rounded-[4px] bg-[#1c43d1] p-[4px] text-[10px] text-[#ffffff]">
              プレミアム
            </span>
          ) : null}
        </div>
      </Flipped>
      <div className="p-[8px]">
        <div className="mb-[4px] text-[14px] font-bold text-[#ffffff]">
          <Ellipsis ellipsis reflowOnResize maxLine={2} text={episode.title} visibleLine={2} />
        </div>
        <div className="text-[12px] text-[#999999]">
          <Ellipsis ellipsis reflowOnResize maxLine={2} text={series.title} visibleLine={2} />
        </div>
      </div>
    </>
  );
});

EpisodeContent.displayName = 'EpisodeContent';

export const EpisodeItem = memo(({ episode }: Props) => {
  const [showThumbnail, setShowThumbnail] = useState(false);

  if (!episode.series) {
    return null;
  }

  return (
    <Hoverable classNames={{ hovered: 'opacity-75' }}>
      <NavLink 
        className="block w-[280px] overflow-hidden" 
        to={`/episodes/${episode.id}`}
        onMouseEnter={() => setShowThumbnail(true)}
        onFocus={() => setShowThumbnail(true)}
      >
        {({ isTransitioning }) => (
          <EpisodeContent 
            episode={episode} 
            showThumbnail={showThumbnail} 
            isTransitioning={isTransitioning} 
          />
        )}
      </NavLink>
    </Hoverable>
  );
});
