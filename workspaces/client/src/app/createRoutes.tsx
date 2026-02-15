import { RouteObject } from 'react-router';

import { Document, prefetch } from '@wsh-2025/client/src/app/Document';
import { createStore } from '@wsh-2025/client/src/app/createStore';
import { HomePage, prefetchHomepage } from '@wsh-2025/client/src/pages/home/components/HomePage';
import { EpisodePage, prefetchEpisodePage } from '@wsh-2025/client/src/pages/episode/components/EpisodePage';
import { ProgramPage, prefetchProgramPage } from '@wsh-2025/client/src/pages/program/components/ProgramPage';
import { SeriesPage, prefetchSeriesPage } from '@wsh-2025/client/src/pages/series/components/SeriesPage';
import { TimetablePage, prefetchTimetablePage } from '@wsh-2025/client/src/pages/timetable/components/TimetablePage';
import { NotFoundPage, prefetchNotFoundPage } from '@wsh-2025/client/src/pages/not_found/components/NotFoundPage';

export function createRoutes(store: ReturnType<typeof createStore>): RouteObject[] {
  return [
    {
      children: [
        {
          index: true,
          async lazy() {
            // const { HomePage, prefetch } = await import('@wsh-2025/client/src/pages/home/components/HomePage');
            return {
              element: <HomePage />,
              async loader() {
                return await prefetchHomepage(store);
              },
            };
          },
        },
        {
          async lazy() {
            // const { EpisodePage, prefetch } = await import('@wsh-2025/client/src/pages/episode/components/EpisodePage');
            return {
              element: <EpisodePage />,
              async loader({ params }) {
                return await prefetchEpisodePage(store, params);
              },
            };
          },
          path: '/episodes/:episodeId',
        },
        {
          async lazy() {
            // const { prefetch, ProgramPage } = await import('@wsh-2025/client/src/pages/program/components/ProgramPage');
            return {
              element: <ProgramPage />,
              async loader({ params }) {
                return await prefetchProgramPage(store, params);
              },
            };
          },
          path: '/programs/:programId',
        },
        {
          async lazy() {
            // const { prefetch, SeriesPage } = await import('@wsh-2025/client/src/pages/series/components/SeriesPage');
            return {
              element: <SeriesPage />,
              async loader({ params }) {
                return await prefetchSeriesPage(store, params);
              },
            };
          },
          path: '/series/:seriesId',
        },
        {
          async lazy() {
            // const { prefetch, TimetablePage } = await import('@wsh-2025/client/src/pages/timetable/components/TimetablePage');
            return {
              element: <TimetablePage />,
              async loader() {
                return await prefetchTimetablePage(store);
              },
            };
          },
          path: '/timetable',
        },
        {
          async lazy() {
            // const { NotFoundPage, prefetch } = await import('@wsh-2025/client/src/pages/not_found/components/NotFoundPage');
            return {
              element: <NotFoundPage />,
              async loader() {
                return await prefetchNotFoundPage(store);
              },
            };
          },
          path: '*',
        },
      ],
      element: <Document />,
      async loader() {
        return await prefetch(store);
      },
      path: '/',
      hydrateFallbackElement: null,
    },
  ];
}
