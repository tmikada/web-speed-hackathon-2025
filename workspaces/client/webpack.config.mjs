import path from 'node:path';

import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import UnoCSS from '@unocss/webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import webpack from 'webpack';

const isDevelopment = process.env['NODE_ENV'] === 'development';
// const useAnalyzer = process.env['ANALYZE'] === 'true';
const useAnalyzer = isDevelopment;

/** @type {import('webpack').Configuration} */
const config = {
  devtool: isDevelopment ? 'eval-cheap-module-source-map' : false,
  entry: './src/main.tsx',
  mode: isDevelopment ? 'development' : 'production',
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
                  targets: 'last 1 Chrome version',
                  useBuiltIns: false,
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
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  output: {
    chunkFilename: 'chunk-[contenthash].js',
    filename: 'main.js',
    path: path.resolve(import.meta.dirname, './dist'),
    publicPath: 'auto',
  },
  plugins: [
    UnoCSS(),
    new MiniCssExtractPlugin({ filename: 'main.css' }),
    new webpack.EnvironmentPlugin({ API_BASE_URL: '/api', NODE_ENV: 'production' }),
    ...(useAnalyzer ? [new BundleAnalyzerPlugin({ analyzerMode: 'static', openAnalyzer: false, reportFilename: 'bundle-report.html' })] : []),
  ],
  resolve: {
    alias: {},
    extensions: ['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.tsx', '.jsx'],
  },
};

export default config;
