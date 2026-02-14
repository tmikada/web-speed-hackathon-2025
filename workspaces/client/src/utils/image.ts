export function resizedImageUrl(url: string, width: number): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=${width}`;
}
