const createExpoWebpackConfigAsync = require('@expo/webpack-config');

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

  return config;
};
