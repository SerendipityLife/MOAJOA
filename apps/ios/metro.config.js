const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Monorepo Metro config: watch workspace packages so changes hot-reload.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm installs an isolated, symlinked node_modules: a package's transitive
// deps (e.g. whatwg-fetch under @expo/metro-runtime) live in nested .pnpm dirs,
// not in the two nodeModulesPaths above. Hierarchical lookup must stay ON so
// Metro can walk up to find them — disabling it assumes npm/yarn-style hoisting
// and breaks resolution here.
config.resolver.disableHierarchicalLookup = false;

// Watchman's `watch-project` hangs on this checkout (non-ASCII "포맷" path
// segment under Desktop). Opt out to Metro's node filesystem crawler via env,
// so the fix stays local: inert for ASCII checkouts and other developers.
if (process.env.EXPO_NO_WATCHMAN === '1') {
  config.resolver.useWatchman = false;
}

// @supabase/realtime-js lazily require()s 'ws' only in a Node fallback branch
// that never runs on native (global WebSocket is defined), yet Metro still
// bundles it — pulling in Node's 'stream' and failing. Stub 'ws' to an empty
// module so it's excluded; realtime uses the RN global WebSocket. Surgical, vs.
// disabling package exports (which breaks pnpm monorepo resolution).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return { type: 'empty' };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
