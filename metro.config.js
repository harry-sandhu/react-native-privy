const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// ✅ Add Node polyfills
config.resolver.extraNodeModules = {
  crypto: require.resolve("react-native-get-random-values"),
  buffer: require.resolve("buffer"),
  process: require.resolve("process"),
};

// ✅ Safe resolver override (no originalResolveRequest usage)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jose") {
    return context.resolveRequest(
      {
        ...context,
        unstable_conditionNames: ["browser"],
      },
      moduleName,
      platform
    );
  }

  if (moduleName.startsWith("@privy-io/")) {
    return context.resolveRequest(
      {
        ...context,
        unstable_enablePackageExports: true,
      },
      moduleName,
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;