import { RouteObject } from 'react-router';

import { Document, prefetch } from '@wsh-2025/client/src/app/Document';
import { createStore } from '@wsh-2025/client/src/app/createStore';

export function createRoutes(store: ReturnType<typeof createStore>): RouteObject[] {
  return [
    {
      children: [
        {
          index: true,
          async lazy() {
            const { HomePage, prefetch } = await import('@wsh-2025/client/src/pages/home/components/HomePage');
            return {
              Component: HomePage,
              HydrateFallback: () => null,
              async loader() {
                if (typeof window === 'undefined') return {};
                return await prefetch(store);
              },
            };
          },
        },
        {
          async lazy() {
            const { EpisodePage, prefetch } = await import('@wsh-2025/client/src/pages/episode/components/EpisodePage');
            return {
              Component: EpisodePage,
              HydrateFallback: () => null,
              async loader({ params }) {
                if (typeof window === 'undefined') return {};
                return await prefetch(store, params);
              },
            };
          },
          path: '/episodes/:episodeId',
        },
        {
          async lazy() {
            const { prefetch, ProgramPage } = await import('@wsh-2025/client/src/pages/program/components/ProgramPage');
            return {
              Component: ProgramPage,
              HydrateFallback: () => null,
              async loader({ params }) {
                if (typeof window === 'undefined') return {};
                return await prefetch(store, params);
              },
            };
          },
          path: '/programs/:programId',
        },
        {
          async lazy() {
            const { prefetch, SeriesPage } = await import('@wsh-2025/client/src/pages/series/components/SeriesPage');
            return {
              Component: SeriesPage,
              HydrateFallback: () => null,
              async loader({ params }) {
                if (typeof window === 'undefined') return {};
                return await prefetch(store, params);
              },
            };
          },
          path: '/series/:seriesId',
        },
        {
          async lazy() {
            const { prefetch, TimetablePage } = await import('@wsh-2025/client/src/pages/timetable/components/TimetablePage');
            return {
              Component: TimetablePage,
              HydrateFallback: () => null,
              async loader() {
                if (typeof window === 'undefined') return {};
                return await prefetch(store);
              },
            };
          },
          path: '/timetable',
        },
        {
          async lazy() {
            const { NotFoundPage, prefetch } = await import('@wsh-2025/client/src/pages/not_found/components/NotFoundPage');
            return {
              Component: NotFoundPage,
              HydrateFallback: () => null,
              async loader() {
                if (typeof window === 'undefined') return {};
                return await prefetch(store);
              },
            };
          },
          path: '*',
        },
      ],
      Component: Document,
      HydrateFallback: () => null,
      async loader() {
        if (typeof window === 'undefined') return {};
        return await prefetch(store);
      },
      path: '/',
    },
  ];
}
