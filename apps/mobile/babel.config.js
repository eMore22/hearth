module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // This MUST be the LAST plugin
      'react-native-reanimated/plugin'
    ],
  };
};
