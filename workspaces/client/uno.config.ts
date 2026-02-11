// workspaces/client/uno.config.ts
import presetIcons from '@unocss/preset-icons';
import presetWind3 from '@unocss/preset-wind3';

export default {
  presets: [
    presetWind3(),
    presetIcons({
      // ビルド時にNode.jsで解決されるので、動的importではなく直接指定できる
      collections: {
        bi: () => import('@iconify/json/json/bi.json').then(m => m.default),
        bx: () => import('@iconify/json/json/bx.json').then(m => m.default),
        'fa-regular': () => import('@iconify/json/json/fa-regular.json').then(m => m.default),
        'fa-solid': () => import('@iconify/json/json/fa-solid.json').then(m => m.default),
        fluent: () => import('@iconify/json/json/fluent.json').then(m => m.default),
        'line-md': () => import('@iconify/json/json/line-md.json').then(m => m.default),
        'material-symbols': () => import('@iconify/json/json/material-symbols.json').then(m => m.default),
      },
    }),
  ],
  // 現在unocss.tsにあるpreflightsもここに移動
  preflights: [
    {
      getCSS: () => `
        @view-transition { navigation: auto; }
        html, :host { font-family: 'Noto Sans JP', sans-serif !important; }
        video { max-height: 100%; max-width: 100%; }
      `,
    },
    {
      getCSS: () => `
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
    },
  ],
    safelist: [
    'i-material-symbols:pause-rounded',
    'i-material-symbols:play-arrow-rounded',
    'i-material-symbols:volume-off-rounded',
    'i-material-symbols:volume-up-rounded',
    ],  
};
