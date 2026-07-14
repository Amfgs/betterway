const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const reactPath = path.dirname(require.resolve("react/package.json", { paths: [__dirname] }));
const reactNativePath = path.dirname(require.resolve("react-native/package.json", { paths: [__dirname] }));

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: reactPath,
  "react-native": reactNativePath
};
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../node_modules")
];

module.exports = config;
