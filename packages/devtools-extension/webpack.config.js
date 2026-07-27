// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  /*** DevTools + Panel Config ***/
  const devToolsConfig = {
    entry: {
      devtools: './src/devtools.ts',
      panel: './src/index.tsx',
    },
    devtool: isDev ? 'inline-source-map' : false,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: false,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'devtools.html',
        template: 'public/devtools.html',
        chunks: ['devtools'],
        inject: 'body',
      }),
      new HtmlWebpackPlugin({
        filename: 'panel.html',
        template: 'public/panel.html',
        chunks: ['panel'],
        inject: 'body',
      }),
      new CopyPlugin({
        patterns: [{ from: 'public/manifest.json', to: '.' }],
      }),
    ],
  };

  /*** Injected Bundle Config ***/
  const injectedConfig = {
    entry: './src/injected/index.ts',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist/injected'),
      filename: 'glob-audit-bundle.js',
      library: 'globAudit', // Exposes to window.globAudit
      libraryTarget: 'window',
      clean: false,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
  };

  /*** Content Script Config ***/
  const contentScriptConfig = {
    entry: './src/content-script.ts',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'content-script.js',
      clean: false,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
  };

  /*** Background Script Config ***/
  const backgroundConfig = {
    entry: './src/background.ts',
    mode: isDev ? 'development' : 'production',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'background.js',
      clean: false,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
  };

  return [devToolsConfig, injectedConfig, contentScriptConfig, backgroundConfig];
};
