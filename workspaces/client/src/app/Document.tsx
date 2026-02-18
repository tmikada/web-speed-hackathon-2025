import { useState, useEffect, Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';

import { createStore } from '@wsh-2025/client/src/app/createStore';
import { Layout } from '@wsh-2025/client/src/features/layout/components/Layout';
import { useStore } from '@wsh-2025/client/src/app/StoreContext';
import { resizedImageUrl } from '@wsh-2025/client/src/utils/image';
import { useCss } from '@wsh-2025/client/src/app/CssContext';

export const prefetch = async (store: ReturnType<typeof createStore>) => {
  const user = await store.getState().features.auth.fetchUser();
  return { user };
};

export const Document = () => {
  const contextCss = useCss(); // SSRでは full CSS, クライアントでは ''
  // SSR: contextCss を使用
  // クライアントハイドレーション: SSRが出力した <style data-main-css> からDOMで取得
  const [cssContent] = useState(() => {
    if (contextCss) return contextCss;
    if (typeof window !== 'undefined') {
      return document.querySelector('style[data-main-css]')?.textContent ?? '';
    }
    return '';
  });

  // 純粋CSR（SSRエラー後フォールバック）: CSSが未ロードなら <link> を動的追加
  useEffect(() => {
    if (!cssContent) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/public/main.css';
      document.head.appendChild(link);
    }
  }, [cssContent]);

  const references = useStore((state) => state.features.recommended.references);
  const recommendedModules = useStore((state) => state.features.recommended.recommendedModules);
  
  const entranceIds = references['entrance'] ?? [];
  const jumbotronModule = entranceIds
  .map((id) => recommendedModules[id])
  .find((m) => m?.type === 'jumbotron');
  // const lcpThumbnailUrl = jumbotronModule?.items[0]?.episode?.thumbnailUrl;

  return (
    <html className="size-full" lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        {/* {lcpThumbnailUrl && (
          <link
            rel="preload"
            as="image"
            href={lcpThumbnailUrl}
            imageSrcSet={resizedImageUrl(lcpThumbnailUrl, 480)}
          />
        )} */}
        <style data-main-css="" dangerouslySetInnerHTML={{ __html: cssContent }} />
        <script defer src="/public/main.js"></script>
      </head>
      <body className="size-full bg-[#000000] text-[#ffffff]">
        <Suspense>
          <Layout>
            <Outlet />
          </Layout>
        </Suspense>
        <ScrollRestoration />
      </body>
    </html>
  );
};
