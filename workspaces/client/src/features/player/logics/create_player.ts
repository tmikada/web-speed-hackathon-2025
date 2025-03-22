import type Hls from 'hls.js';
import { PlayerType } from '@wsh-2025/client/src/features/player/constants/player_type';
import { PlayerWrapper } from '@wsh-2025/client/src/features/player/interfaces/player_wrapper';

class HlsJSPlayerWrapper implements PlayerWrapper {
  readonly videoElement = Object.assign(document.createElement('video'), {
    autoplay: true,
    controls: false,
    muted: true,
    volume: 0.25,
  });
  private _player!: Hls;
  readonly playerType: PlayerType.HlsJS;

  constructor(playerType: PlayerType.HlsJS) {
    this.playerType = playerType;
  }

  async initialize(): Promise<void> {
    const { default: HlsJs } = await import(/* webpackChunkName: "hls.js" */ 'hls.js');
    this._player = new HlsJs({
      enableWorker: false,
      maxBufferLength: 50,
    });
  }

  get currentTime(): number {
    const currentTime = this.videoElement.currentTime;
    return Number.isNaN(currentTime) ? 0 : currentTime;
  }
  get paused(): boolean {
    return this.videoElement.paused;
  }
  get duration(): number {
    const duration = this.videoElement.duration;
    return Number.isNaN(duration) ? 0 : duration;
  }
  get muted(): boolean {
    return this.videoElement.muted;
  }

  load(playlistUrl: string, options: { loop: boolean }): void {
    this._player.attachMedia(this.videoElement);
    this.videoElement.loop = options.loop;
    this._player.loadSource(playlistUrl);
  }
  play(): void {
    void this.videoElement.play();
  }
  pause(): void {
    this.videoElement.pause();
  }
  seekTo(second: number): void {
    this.videoElement.currentTime = second;
  }
  setMuted(muted: boolean): void {
    this.videoElement.muted = muted;
  }
  destory(): void {
    this._player.destroy();
  }
}

export const createPlayer = async (playerType: PlayerType): Promise<PlayerWrapper> => {
  let player: PlayerWrapper;
  switch (playerType) {
    case PlayerType.HlsJS: {
      player = new HlsJSPlayerWrapper(playerType);
      await (player as HlsJSPlayerWrapper).initialize();
      break;
    }
    default: {
      playerType satisfies never;
      throw new Error('Invalid player type.');
    }
  }
  return player;
};
