// Adds a web "base URL" when one is given, for hosting under a sub-path (GitHub Pages serves a
// project site at https://<user>.github.io/<repo>/). Without EXPO_BASE_URL nothing changes:
// phones, local development and the normal web build all behave exactly as before.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
