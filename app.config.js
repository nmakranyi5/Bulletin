module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    package: "com.bulletinapp.bulletin",
  },
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});