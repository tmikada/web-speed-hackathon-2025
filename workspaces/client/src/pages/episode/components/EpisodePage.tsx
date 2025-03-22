import { Suspense, lazy, useState } from 'react';
import Ellipsis from 'react-ellipsis-component';
import { Flipped } from 'react-flip-toolkit';
import { type Params, useParams } from 'react-router';
import invariant from 'tiny-invariant';

import { createStore } from '@wsh-2025/client/src/app/createStore';
import { useAuthActions } from '@wsh-2025/client/src/features/auth/hooks/useAuthActions';
import { useAuthUser } from '@wsh-2025/client/src/features/auth/hooks/useAuthUser';
import { useEpisodeById } from '@wsh-2025/client/src/features/episode/hooks/useEpisodeById';
import { OptimizedImage } from '@wsh-2025/client/src/features/image/components/OptimizedImage';
import { AspectRatio } from '@wsh-2025/client/src/features/layout/components/AspectRatio';
import { PlayerType } from '@wsh-2025/client/src/features/player/constants/player_type';
import { RecommendedSection } from '@wsh-2025/client/src/features/recommended/components/RecommendedSection';
import { useRecommended } from '@wsh-2025/client/src/features/recommended/hooks/useRecommended';
import { SeriesEpisodeList } from '@wsh-2025/client/src/features/series/components/SeriesEpisodeList';
import { PlayerController } from '@wsh-2025/client/src/pages/episode/components/PlayerController';
import { usePlayerRef } from '@wsh-2025/client/src/pages/episode/hooks/usePlayerRef';

const Player = lazy(() => import('@wsh-2025/client/src/features/player/components/Player').then(module => ({
  default: module.Player
})));

export const prefetch = async (store: ReturnType<typeof createStore>, params: Params) => {
  const { episodeId } = params;
  invariant(episodeId);
  const episode = await store.getState().features.episode.fetchEpisodeById({ episodeId });
  const modules = await store
    .getState()
    .features.recommended.fetchRecommendedModulesByReferenceId({ referenceId: episodeId });
  return { episode, modules };
};

export const EpisodePage = () => {
  const { episodeId } = useParams();
  invariant(episodeId);

  const episode = useEpisodeById({ episodeId });
  const modules = useRecommended({ referenceId: episodeId });
  const playerRef = usePlayerRef();
  const user = useAuthUser();
  const { openSignInDialog } = useAuthActions();
  const [showPremiumThumbnail, setShowPremiumThumbnail] = useState(false);
  const [showLoadingThumbnail, setShowLoadingThumbnail] = useState(false);
  const [showPlayerThumbnail, setShowPlayerThumbnail] = useState(false);

  if (episode == null) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8">
      <div className="mb-[24px]">
        <Flipped flipId={`episode-${episode.id}`}>
          <div className="relative w-full py-6">
            {episode.premium && user == null ? (
              <AspectRatio 
                ratioHeight={9} 
                ratioWidth={16}
                onInView={() => setShowPremiumThumbnail(true)}
              >
                <div className="relative size-full">
                  {showPremiumThumbnail && (
                    <OptimizedImage
                      alt={episode.title}
                      className="size-full object-cover"
                      height={720}
                      src={episode.thumbnailUrl}
                      width={1280}
                    />
                  )}
                  <div className="absolute inset-0 bg-[#00000077]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="mb-[32px] text-[24px] font-bold text-[#ffffff]">
                      プレミアムエピソードの視聴にはログインが必要です
                    </p>
                    <button
                      className="block flex w-[160px] flex-row items-center justify-center rounded-[4px] bg-[#1c43d1] p-[12px] text-[14px] font-bold text-[#ffffff] disabled:opacity-50"
                      type="button"
                      onClick={() => {
                        openSignInDialog();
                      }}
                    >
                      ログイン
                    </button>
                  </div>
                </div>
              </AspectRatio>
            ) : (
              <Suspense
                fallback={
                  <AspectRatio 
                    ratioHeight={9} 
                    ratioWidth={16}
                    onInView={() => setShowLoadingThumbnail(true)}
                  >
                    <div className="grid size-full">
                      {showLoadingThumbnail && (
                        <OptimizedImage
                          alt={episode.title}
                          className="size-full place-self-stretch object-cover [grid-area:1/-1]"
                          height={720}
                          src={episode.thumbnailUrl}
                          width={1280}
                        />
                      )}
                      <div className="size-full place-self-stretch bg-[#00000077] [grid-area:1/-1]" />
                      <div className="i-line-md:loading-twotone-loop size-[48px] place-self-center text-[#ffffff] bg-current [grid-area:1/-1]" />
                    </div>
                  </AspectRatio>
                }
              >
                <AspectRatio 
                  ratioHeight={9} 
                  ratioWidth={16}
                  onInView={() => setShowPlayerThumbnail(true)}
                >
                  <div className="relative size-full">
                    {showPlayerThumbnail && (
                      <Player
                        className="size-full"
                        playerRef={playerRef}
                        playerType={PlayerType.HlsJS}
                        playlistUrl={`/streams/episode/${episode.id}/playlist.m3u8`}
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0">
                      <PlayerController episode={episode} />
                    </div>
                  </div>
                </AspectRatio>
              </Suspense>
            )}
          </div>
        </Flipped>

        <div className="mb-[24px]">
          <div className="text-[16px] text-[#ffffff]">
            <Ellipsis ellipsis reflowOnResize maxLine={1} text={episode.series.title} visibleLine={1} />
          </div>
          <h1 className="mt-[8px] text-[22px] font-bold text-[#ffffff]">
            <Ellipsis ellipsis reflowOnResize maxLine={2} text={episode.title} visibleLine={2} />
          </h1>
          {episode.premium ? (
            <div className="mt-[8px]">
              <span className="inline-flex items-center justify-center rounded-[4px] bg-[#1c43d1] p-[4px] text-[10px] text-[#ffffff]">
                プレミアム
              </span>
            </div>
          ) : null}
          <div className="mt-[16px] text-[16px] text-[#999999]">
            <Ellipsis ellipsis reflowOnResize maxLine={3} text={episode.description} visibleLine={3} />
          </div>
        </div>

        {modules[0] != null ? (
          <div className="mb-[24px] mx-[-16px] px-[16px]">
            <RecommendedSection module={modules[0]} />
          </div>
        ) : null}

        {episode.series.episodes.length > 1 ? (
          <div>
            <h2 className="mb-[16px] text-[22px] font-bold text-[#ffffff]">エピソード</h2>
            <SeriesEpisodeList episodes={episode.series.episodes} selectedEpisodeId={episode.id} />
          </div>
        ) : null}
      </div>
    </div>
  );
};
