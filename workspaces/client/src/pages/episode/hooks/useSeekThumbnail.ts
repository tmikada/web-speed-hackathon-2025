import { StandardSchemaV1 } from '@standard-schema/spec';
import * as schema from '@wsh-2025/schema/src/api/schema';
import { Parser } from 'm3u8-parser';
import { use } from 'react';

interface Params {
  episode: StandardSchemaV1.InferOutput<typeof schema.getEpisodeByIdResponse>;
}

async function generateThumbnailFromVideo(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    video.autoplay = false;
    video.muted = true;
    video.src = URL.createObjectURL(videoBlob);

    video.onloadeddata = () => {
      canvas.width = 160;
      canvas.height = 90;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Clean up
      URL.revokeObjectURL(video.src);
      video.remove();
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
      reject(new Error('Failed to load video'));
    };
  });
}

async function getSeekThumbnail({ episode }: Params): Promise<string> {
  try {
    // HLS のプレイリストを取得
    const playlistUrl = `/streams/episode/${episode.id}/playlist.m3u8`;
    const parser = new Parser();
    const playlistResponse = await fetch(playlistUrl);
    if (!playlistResponse.ok) {
      throw new Error('Failed to fetch playlist');
    }
    const playlistText = await playlistResponse.text();
    parser.push(playlistText);
    parser.end();

    const segments = parser.manifest.segments;
    if (segments?.length === 0) {
      throw new Error('No segments found in playlist');
    }

    // 最初のセグメントファイルのみを取得
    const firstSegment = segments?.[0];
    if (!firstSegment || !firstSegment.uri) {
      throw new Error('Invalid segment data');
    }

    const response = await fetch(firstSegment.uri);
    if (!response.ok) {
      throw new Error('Failed to fetch video segment');
    }
    const videoBlob = await response.blob();
    
    // サムネイルを生成
    return await generateThumbnailFromVideo(videoBlob);
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    // エラーが発生した場合は、デフォルトのサムネイルを返す
    return episode.thumbnailUrl;
  }
}

const weakMap = new WeakMap<object, Promise<string>>();

export const useSeekThumbnail = ({ episode }: Params): string => {
  const promise = weakMap.get(episode) ?? getSeekThumbnail({ episode });
  weakMap.set(episode, promise);
  return use(promise);
};
