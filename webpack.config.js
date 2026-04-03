const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const CopyWebpackPlugin = require('copy-webpack-plugin');
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
          from: 'node_modules/canvaskit-wasm/bin/canvaskit.wasm',
          to: 'canvaskit.wasm',
        },
      ],
    })
  );

  // Fix for canvaskit-wasm trying to require Node.js modules on web
  if (!config.resolve) {
    config.resolve = {};
  }
  config.resolve.fallback = {
    ...config.resolve.fallback,
    fs: false,
    path: false,
  };

  return config;
};
