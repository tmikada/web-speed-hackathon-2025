import path from 'node:path';

import CompressionPlugin from 'compression-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

/** @type {import('webpack').Configuration} */
const config = {
  // devtool: 'source-map',
  devtool: false,
  entry: {
    main: {
      filename: '[name].[contenthash].js',
      import: ['./src/main.tsx'],
    },
  },
  mode: 'production',
  module: {
    rules: [
      {
        exclude: [/node_modules\/video\.js/, /node_modules\/@videojs/],
        resolve: {
          fullySpecified: false,
        },
        test: /\.(?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    esmodules: true,
                  },
                },
              ],
              ['@babel/preset-react', { runtime: 'automatic' }],
              ['@babel/preset-typescript'],
            ],
          },
        },
      },
      {
        test: /\.png$/,
        type: 'asset/inline',
      },
      {
        resourceQuery: /raw/,
        type: 'asset/source',
      },
      {
        resourceQuery: /arraybuffer/,
        type: 'javascript/auto',
        use: {
          loader: 'arraybuffer-loader',
        },
      },
    ],
  },
  // FFmpegなどの大きなライブラリを別々のチャンクとして扱うための設定
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log']
          },
          format: {
            comments: false,
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
    moduleIds: 'deterministic',
    splitChunks: {
      cacheGroups: {
        common: {
          minChunks: 2,
          name: 'common',
          priority: -10,
          reuseExistingChunk: true,
        },
        defaultVendors: {
          minSize: 10000,
          /** @param {object & { context?: string }} module */
          name(module) {
            if (!module.context) return 'vendor';
            const match = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
            const packageName = match?.[1]?.replace('@', '') ?? 'vendor';
            return `vendor.${packageName.split('/')[0]}`;
          },
          priority: 10,
          reuseExistingChunk: true,
          test: /[\\/]node_modules[\\/]/,
        },
        hls: {
          name: 'vendor.hls',
          priority: 18,
          reuseExistingChunk: true,
          test: /[\\/]node_modules[\\/](hls\.js|@ffmpeg)[\\/]/,
        },
        react: {
          name: 'vendor.react',
          priority: 20,
          reuseExistingChunk: true,
          test: /[\\/]node_modules[\\/](react|react-dom|@remix-run)[\\/]/,
        },
        sql: {
          name: 'vendor.sql',
          priority: 17,
          reuseExistingChunk: true,
          test: /[\\/]node_modules[\\/](sql\.js|@jlongster\/sql\.js|better-sqlite3|sqlite3)[\\/]/,
        },
        ui: {
          name: 'vendor.ui',
          priority: 15,
          reuseExistingChunk: true,
          test: /[\\/]node_modules[\\/](@radix-ui|@floating-ui|@headlessui|@heroicons)[\\/]/,
        },
      },
      chunks: 'all',
      maxAsyncRequests: 20,
      maxInitialRequests: 20,
      minSize: 20000,
    },
  },
  output: {
    chunkFilename: 'chunk-[contenthash].js',
    // chunkFormat: false,
    filename: '[name].[contenthash].js',
    path: path.resolve(import.meta.dirname, './dist'),
    publicPath: 'auto',
  },
  plugins: [
    // new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.EnvironmentPlugin({ API_BASE_URL: '/api', NODE_ENV: '' }),
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      /** @param {Record<string, string>} seed */
      /** @param {Array<{name: string, path: string}>} files */
      generate: (seed, files) => {
        const manifestFiles = files.reduce((manifest, file) => {
          if (file && typeof file === 'object' && 'name' in file && 'path' in file) {
            manifest[file.name] = file.path;
          }
          return manifest;
        }, /** @type {Record<string, string>} */(seed || {}));
        return manifestFiles;
      },
      publicPath: '/public/',
    }),
    new CompressionPlugin({
      algorithm: 'gzip',
      // 10KB以上のファイルのみ圧縮
      minRatio: 0.8,
      test: /\.(js|css|html|svg)$/, threshold: 10240,
    }),
    process.env['ANALYZE'] === 'true' && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: '../bundle-analysis.html',
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@ffmpeg/core$': path.resolve(import.meta.dirname, 'node_modules', '@ffmpeg/core/dist/umd/ffmpeg-core.js'),
      '@ffmpeg/core/wasm$': path.resolve(import.meta.dirname, 'node_modules', '@ffmpeg/core/dist/umd/ffmpeg-core.wasm'),
    },
    extensions: ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.tsx', '.jsx'],
    // modules: [path.resolve(import.meta.dirname, 'src'), 'node_modules'],
  },
};


export default config;
