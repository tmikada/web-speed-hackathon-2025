/**
 * 画像URLを最適化された形式に変換します
 * - クエリパラメータを除去
 * - .jpeg拡張子を.webpに変換
 */
export function optimizeImageUrl(url: string): string {
  // URLからクエリパラメータを除去
  const urlWithoutQuery = url.split('?')[0];
  
  // .jpeg拡張子を.webpに変換
  return urlWithoutQuery.replace(/\.jpeg$/, '.webp');
} 