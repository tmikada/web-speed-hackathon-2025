import { Ref, useEffect, useRef, useState } from 'react';
import invariant from 'tiny-invariant';
import { assignRef } from 'use-callback-ref';

import { PlayerType } from '@wsh-2025/client/src/features/player/constants/player_type';
import { PlayerWrapper } from '@wsh-2025/client/src/features/player/interfaces/player_wrapper';

interface Props {
  className?: string;
  loop?: boolean;
  playerRef: Ref<PlayerWrapper | null>;
  playerType: PlayerType;
  playlistUrl: string;
}

export const Player = ({ className, loop, playerRef, playerType, playlistUrl }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const mountElement = mountRef.current;
    invariant(mountElement);

    const abortController = new AbortController();
    let player: PlayerWrapper | null = null;

    void (async () => {
      try {
        const { createPlayer } = await import('@wsh-2025/client/src/features/player/logics/create_player');
        if (abortController.signal.aborted) {
          return;
        }

        player = await createPlayer(playerType);
        
        // 動画の読み込み状態を監視
        const handleLoadStart = () => {
          setIsLoading(true);
        };
        const handleCanPlay = () => {
          setIsLoading(false);
        };
        const handleError = () => {
          setIsLoading(false);
        };
        
        player.videoElement.addEventListener('loadstart', handleLoadStart);
        player.videoElement.addEventListener('canplay', handleCanPlay);
        player.videoElement.addEventListener('error', handleError);
        
        player.load(playlistUrl, { loop: loop ?? false });
        mountElement.appendChild(player.videoElement);
        assignRef(playerRef, player);

        return () => {
          player?.videoElement.removeEventListener('loadstart', handleLoadStart);
          player?.videoElement.removeEventListener('canplay', handleCanPlay);
          player?.videoElement.removeEventListener('error', handleError);
        };
      } catch (error) {
        console.error('Failed to initialize player:', error);
        setIsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
      if (player != null) {
        mountElement.removeChild(player.videoElement);
        player.destory();
      }
      assignRef(playerRef, null);
    };
  }, [playerType, playlistUrl, loop]);

  return (
    <div className={className}>
      <div className="relative size-full">
        <div ref={mountRef} className="size-full" />

        {isLoading && (
          <div className="absolute inset-0 z-10 grid place-content-center bg-black/50">
            <div className="i-line-md:loading-twotone-loop size-[48px] text-[#ffffff] bg-current" />
          </div>
        )}
      </div>
    </div>
  );
};
