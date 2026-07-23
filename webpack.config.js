require('dotenv').config();
const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Filter a known noisy warning from react-native-worklets on web builds.
  // This does not change the emitted bundle, only the terminal output.
  const baseStats = config.stats;
  const preset =
    typeof baseStats === 'string'
      ? baseStats
      : typeof baseStats === 'boolean'
        ? baseStats
          ? 'normal'
          : 'none'
        : undefined;

  const statsObj =
    baseStats && typeof baseStats === 'object'
      ? baseStats
      : preset
        ? { preset }
        : {};

  // Webpack v6+ deprecates `stats.warningsFilter` in favor of `ignoreWarnings`.
  config.stats = { ...statsObj };
  config.ignoreWarnings = [
    ...((statsObj && typeof statsObj === 'object' && Array.isArray(statsObj.warningsFilter))
      ? statsObj.warningsFilter
      : []),
    /react-native-worklets[\s\S]*require\.getModules\(\)/,
    /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
    // Supprime le warning "Critical dependency" de react-datepicker (require() dynamique dans date-fns-tz)
    (warning) => {
      const msg = warning.message || '';
      const file = (warning.module && warning.module.resource) || '';
      return (
        msg.includes('Critical dependency') &&
        (file.includes('react-datepicker') || msg.includes('date-fns-tz'))
      );
    },
  ];

  // Fix: Victory Native and Skia for web
  // Force transpilation of these modules as they contain JSX/modern JS
  config.module.rules.unshift({
    test: /\.(js|jsx|ts|tsx)$/,
    include: /[\\/]node_modules[\\/](victory-native|@shopify[\\/]react-native-skia)[\\/]/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
      },
    },
  });

  // Support for Skia Web (.wasm)
  if (!config.plugins) {
    config.plugins = [];
  }
  config.plugins.push(
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/canvaskit-wasm/bin/full/canvaskit.wasm',
          to: 'canvaskit.wasm',
        },
        {
          from: 'public/sw.js',
          to: 'sw.js',
          noErrorOnMissing: true,
        },
      ],
    })
  );

  // Inject AI API keys as compile-time constants for Webpack
  // Keys are read from .env at build/serve time, not hardcoded in source
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.EXPO_PUBLIC_GEMINI_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''),
      'process.env.EXPO_PUBLIC_GROC_API_KEY': JSON.stringify(process.env.EXPO_PUBLIC_GROC_API_KEY || ''),
    })
  );

  // Support for Skia Web (.wasm)
  // We use CopyWebpackPlugin to place it at the root, so we don't need an asset rule
  // that might conflict or rename the file.

  // Fix for canvaskit-wasm trying to require Node.js modules on web
  if (!config.resolve) {
    config.resolve = {};
  }
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
  };

  // Support WASM pour @xenova/transformers (runtime ONNX)
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
  };

  // Servir les fichiers .wasm comme assets binaires
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'asset/resource',
  });

  // Force WebSocket HMR configuration to avoid "WebSocket connection failed"
  if (config.devServer) {
    config.devServer.allowedHosts = 'all';
    config.devServer.client = {
      ...config.devServer.client,
      webSocketURL: {
        hostname: 'localhost',
        pathname: '/hot', // Expo Web specific
        port: 19006,
      },
    };
    // Proxy /api to a local dev API server (started with `npm run dev:api`)
    config.devServer.proxy = {
      '/api': {
        target: 'http://localhost:3333',
        secure: false,
        changeOrigin: true,
        timeout: 2000,
        proxyTimeout: 2000,
      },
    };
  }

  // Exclude MapLibre from web build (it's React Native only)
  if (!config.resolve) {
    config.resolve = {};
  }
  if (!config.resolve.alias) {
    config.resolve.alias = {};
  }
  config.resolve.alias['@maplibre/maplibre-react-native'] = path.resolve(__dirname, 'src/utils/maplibre-mock.js');

  return config;
};
