import { memo } from 'react';

interface Props {
  alt: string;
  className?: string;
  height?: number;
  loading?: 'eager' | 'lazy';
  src: string;
  width?: number;
}

export const OptimizedImage = memo(function OptimizedImage({ alt, className, height, loading = 'lazy', src, width }: Props) {
  // WebPのパスを生成
  const webpSrc = src.replace(/\.(jpe?g|gif)$/, '.webp');
  
  return (
    <picture>
      {/* WebPをサポートしているブラウザ用 */}
      <source
        srcSet={webpSrc}
        type="image/webp"
      />
      {/* フォールバック用の元画像 */}
      <img
        alt={alt}
        className={className}
        decoding="async"
        height={height}
        loading={loading}
        src={src}
        width={width}
        onError={(e) => {
          // エラー時のフォールバック処理
          const target = e.target as HTMLImageElement;
          target.onerror = null; // 無限ループを防ぐ
          target.src = src; // 元の画像にフォールバック
        }}
      />
    </picture>
  );
}); 