import fs from 'node:fs';
import { createRequire } from 'node:module';

import presetIcons from '@unocss/preset-icons';
import presetWind3 from '@unocss/preset-wind3';
import type { UserConfig } from '@unocss/webpack';

const require = createRequire(import.meta.url);
const tailwindCompatReset = fs.readFileSync(require.resolve('@unocss/reset/tailwind-compat.css'), 'utf-8');

const config: UserConfig = {
  layers: {
    default: 1,
    icons: 0,
    preflights: 0,
    reset: -1,
  },
  preflights: [
    {
      getCSS: () => tailwindCompatReset as string,
      layer: 'reset',
    },
    {
      getCSS: () => `
        @view-transition {
          navigation: auto;
        }
        html,
        :host {
          font-family: 'Noto Sans JP', sans-serif !important;
        }
        video {
          max-height: 100%;
          max-width: 100%;
        }
      `,
    },
    {
      getCSS: () => `
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `,
    },
  ],
  presets: [
    presetWind3(),
    presetIcons({
      collections: {
        bi: () => import('@iconify/json/json/bi.json').then((m) => m.default),
        'fa-solid': () => import('@iconify/json/json/fa-solid.json').then((m) => m.default),
        fluent: () => import('@iconify/json/json/fluent.json').then((m) => m.default),
        'line-md': () => import('@iconify/json/json/line-md.json').then((m) => m.default),
        'material-symbols': () => import('@iconify/json/json/material-symbols.json').then((m) => m.default),
      },
    }),
  ],
  safelist: [
    // Layout.tsx: dynamic icon toggle
    'i-fa-solid:user',
    'i-fa-solid:sign-out-alt',
    // PlayerController: dynamic icon toggles
    'i-material-symbols:play-arrow-rounded',
    'i-material-symbols:pause-rounded',
    'i-material-symbols:volume-up-rounded',
    'i-material-symbols:volume-off-rounded',
    // Program.tsx: ternary-based classes
    'opacity-0',
    'opacity-50',
    'opacity-100',
    'bg-[#FCF6E5]',
    'bg-[#212121]',
    'text-[#767676]',
    'text-[#999999]',
    'text-[#212121]',
    'text-[#ffffff]',
    // Hoverable: dynamic hover: prefix
    'hover:brightness-200',
    'hover:brightness-125',
    'hover:bg-[#FFFFFF1F]',
    // TimelineYAxis: constant height
    'h-[480px]',
  ],
};

export default config;
