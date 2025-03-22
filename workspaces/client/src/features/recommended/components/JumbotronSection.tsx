import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { useRef, Suspense, lazy } from 'react';
import Ellipsis from 'react-ellipsis-component';
import { Flipped } from 'react-flip-toolkit';
import { NavLink } from 'react-router';
import invariant from 'tiny-invariant';
import { ArrayValues } from 'type-fest';

import { PlayerType } from '../../player/constants/player_type';
import { PlayerWrapper } from '../../player/interfaces/player_wrapper';

import { Hoverable } from '@wsh-2025/client/src/features/layout/components/Hoverable';

const Player = lazy(() => import('../../player/components/Player').then(mod => ({ default: mod.Player })));

interface Props {
  module: ArrayValues<StandardSchemaV1.InferOutput<typeof schema.getRecommendedModulesResponse>>;
}

export const JumbotronSection = ({ module }: Props) => {
  const playerRef = useRef<PlayerWrapper>(null);

  const episode = module.items[0]?.episode;
  invariant(episode);

  return (
    <Hoverable classNames={{ hovered: 'opacity-50' }}>
      <NavLink
        viewTransition
        className="block flex h-[260px] w-full flex-row items-center justify-center overflow-hidden rounded-[8px] bg-[#171717]"
        to={`/episodes/${episode.id}`}
      >
        {({ isTransitioning }) => {
          return (
            <>
              <div className="flex min-w-0 grow basis-3/5 flex-col justify-center p-[24px]">
                <div className="mb-[16px] min-h-[66px] w-full text-center text-[22px] font-bold text-[#ffffff]">
                  <Ellipsis ellipsis reflowOnResize maxLine={2} text={episode.title} visibleLine={2} />
                </div>
                <div className="min-h-[63px] w-full text-center text-[14px] font-bold text-[#ffffff]">
                  <Ellipsis ellipsis reflowOnResize maxLine={3} text={episode.description} visibleLine={3} />
                </div>
              </div>

              <Flipped stagger flipId={isTransitioning ? `episode-${episode.id}` : 0}>
                <div className="aspect-video h-[260px] w-[462px] shrink-0">
                  <Suspense fallback={
                    <div className="w-full h-full bg-gray-800 animate-pulse flex items-center justify-center">
                      <span className="text-white">Loading...</span>
                    </div>
                  }>
                    <Player
                      loop
                      playerRef={playerRef}
                      playerType={PlayerType.HlsJS}
                      playlistUrl={`/streams/episode/${episode.id}/playlist.m3u8`}
                    />
                  </Suspense>
                </div>
              </Flipped>
            </>
          );
        }}
      </NavLink>
    </Hoverable>
  );
};
