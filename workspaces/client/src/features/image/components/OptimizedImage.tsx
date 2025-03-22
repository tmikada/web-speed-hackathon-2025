import { memo } from 'react';

interface Props {
  alt: string;
  className?: string;
  height?: number;
  loading?: 'eager' | 'lazy';
  priority?: boolean;
  src: string;
  width?: number;
}

export const OptimizedImage = memo(function OptimizedImage({ 
  alt,
  className,
  height,
  loading = 'lazy',
  priority = false,
  src,
  width
}: Props) {
  // WebPのパスを生成
  const webpSrc = src.replace(/\.(jpe?g|gif)$/, '.webp');
  
  return (
    <img
      alt={alt}
      className={className}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : (loading === 'eager' ? 'high' : 'auto')}
      height={height}
      loading={priority ? 'eager' : loading}
      sizes={width ? `${width}px` : '100vw'}
      src={webpSrc}
      width={width}
      onError={(e) => {
        // WebPがサポートされていない場合や読み込みエラー時は元の画像にフォールバック
        const target = e.target as HTMLImageElement;
        if (target.src !== src) {
          target.onerror = null; // 無限ループを防ぐ
          target.src = src; // 元の画像にフォールバック
        }
      }}
    />
  );
}); 