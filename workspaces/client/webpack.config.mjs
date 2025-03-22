import path from 'node:path';

import webpack from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

/** @typedef {import('webpack').Compiler} Compiler */
/** @typedef {import('webpack').WebpackPluginInstance} WebpackPluginInstance */

/** @type {import('webpack').Configuration} */
const config = {
  devtool: process.env['NODE_ENV'] === 'production' ? 'source-map' : 'inline-source-map',
  entry: './src/main.tsx',
  // mode: process.env['NODE_ENV'] === 'production' ? 'production' : 'development',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$/,
        resolve: {
          fullySpecified: false,
        },
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  corejs: '3.41',
                  forceAllTransforms: true,
                  targets: 'defaults',
                  useBuiltIns: 'entry',
                },
              ],
              ['@babel/preset-react', { runtime: 'automatic' }],
              ['@babel/preset-typescript'],
            ],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|webp|avif)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 4 * 1024, // 4KB
          },
        },
        generator: {
          filename: 'images/[name].[contenthash][ext]',
        },
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
  output: {
    chunkFilename: '[name].[contenthash].js',
    filename: '[name].[contenthash].js',
    path: path.resolve(import.meta.dirname, './dist'),
    publicPath: 'auto',
    clean: true,
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 20,
      maxAsyncRequests: 20,
      minSize: 20000,
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          /** @param {object} module */
          name(module) {
            if (!module || typeof module !== 'object' || !module.context) return 'vendor';
            const match = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
            const packageName = match?.[1]?.replace('@', '') ?? 'vendor';
            return `vendor.${packageName}`;
          },
          priority: 10,
          reuseExistingChunk: true,
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: -10,
          reuseExistingChunk: true,
        },
      },
    },
    minimize: true,
    moduleIds: 'deterministic',
  },
  plugins: [
    new webpack.EnvironmentPlugin({ API_BASE_URL: '/api', NODE_ENV: process.env['NODE_ENV'] || 'development' }),
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      publicPath: '/public/',
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
    }),
    process.env['ANALYZE'] === 'true' && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: '../bundle-analysis.html',
      openAnalyzer: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@ffmpeg/core$': path.resolve(import.meta.dirname, 'node_modules', '@ffmpeg/core/dist/umd/ffmpeg-core.js'),
      '@ffmpeg/core/wasm$': path.resolve(import.meta.dirname, 'node_modules', '@ffmpeg/core/dist/umd/ffmpeg-core.wasm'),
    },
    extensions: ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.tsx', '.jsx'],
  },
};

export default config;
