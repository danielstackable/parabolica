import { getAstroStudioEnv, getManagedAppTokenOrExit } from "@astrojs/studio";
import { loadEnv } from "vite";
import "./types.js";
function getAstroEnv(envMode = "") {
  const env = loadEnv(envMode, process.cwd(), "ASTRO_");
  return env;
}
function getRemoteDatabaseInfo() {
  const astroEnv = getAstroEnv();
  const studioEnv = getAstroStudioEnv();
  if (studioEnv.ASTRO_STUDIO_REMOTE_DB_URL)
    return {
      type: "studio",
      url: studioEnv.ASTRO_STUDIO_REMOTE_DB_URL
    };
  if (astroEnv.ASTRO_DB_REMOTE_URL)
    return {
      type: "libsql",
      url: astroEnv.ASTRO_DB_REMOTE_URL
    };
  return {
    type: "studio",
    url: "https://db.services.astro.build"
  };
}
function getManagedRemoteToken(token, dbInfo) {
  dbInfo ??= getRemoteDatabaseInfo();
  if (dbInfo.type === "studio") {
    return getManagedAppTokenOrExit(token);
  }
  const astroEnv = getAstroEnv();
  return Promise.resolve({
    token: token ?? astroEnv.ASTRO_DB_APP_TOKEN,
    renew: () => Promise.resolve(),
    destroy: () => Promise.resolve()
  });
}
function getDbDirectoryUrl(root) {
  return new URL("db/", root);
}
function defineDbIntegration(integration) {
  return integration;
}
function mapObject(item, callback) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, callback(key, value)])
  );
}
export {
  defineDbIntegration,
  getAstroEnv,
  getDbDirectoryUrl,
  getManagedRemoteToken,
  getRemoteDatabaseInfo,
  mapObject
};
