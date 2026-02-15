import 'uno.css';

import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createBrowserRouter, HydrationState, RouterProvider } from 'react-router';

import { StoreProvider } from '@wsh-2025/client/src/app/StoreContext';
import { createRoutes } from '@wsh-2025/client/src/app/createRoutes';
import { createStore } from '@wsh-2025/client/src/app/createStore';

declare global {
  var __zustandHydrationData: unknown;
  var __staticRouterHydrationData: HydrationState;
}

function main() {
  // const store = createStore({});
  // const router = createBrowserRouter(createRoutes(store), {});
  const store = createStore({
    hydrationData: window.__zustandHydrationData,
  });
  const router = createBrowserRouter(
    createRoutes(store),
    {
      hydrationData: window.__staticRouterHydrationData,
    }
  );

  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <StoreProvider createStore={() => store}>
        <RouterProvider router={router} />
      </StoreProvider>
    </StrictMode>,
  );
}
console.log('root exists:', document.getElementById('root'));
console.log('hydrationData:', window.__staticRouterHydrationData);
console.log('zustandData:', window.__zustandHydrationData);
// main();
// document.addEventListener('DOMContentLoaded', main);
