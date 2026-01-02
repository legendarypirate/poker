/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack }) => {
    // Exclude undici from client bundle (it's a Node.js-only package)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        undici: false,
      };
      
      // Ignore undici and all its submodules completely in client bundle
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^undici$/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /node_modules[\\/]undici/,
        })
      );

      // Alias undici to false to prevent webpack from processing it
      config.resolve.alias = {
        ...config.resolve.alias,
        undici: false,
      };
    }

    // Mark undici as external to prevent webpack from processing it
    const originalExternals = config.externals;
    config.externals = [
      ...(Array.isArray(originalExternals) ? originalExternals : []),
      ({ request }, callback) => {
        if (request && (request === 'undici' || request.includes('undici'))) {
          return callback(null, 'commonjs ' + request);
        }
        if (typeof originalExternals === 'function') {
          originalExternals({ request }, callback);
        } else {
          callback();
        }
      },
    ];

    // Tell webpack to not parse undici files (prevents syntax errors)
    config.module.noParse = config.module.noParse || [];
    if (Array.isArray(config.module.noParse)) {
      config.module.noParse.push(/node_modules[\\/]undici/);
    } else if (config.module.noParse) {
      config.module.noParse = [config.module.noParse, /node_modules[\\/]undici/];
    } else {
      config.module.noParse = /node_modules[\\/]undici/;
    }

    return config;
  },
  // Ensure experimental features are enabled if needed
  experimental: {
    serverComponentsExternalPackages: ['undici'],
  },
}

module.exports = nextConfig
