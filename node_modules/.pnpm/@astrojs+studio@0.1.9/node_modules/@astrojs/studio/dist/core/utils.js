import { loadEnv } from "vite";
function getAstroStudioEnv(envMode = "") {
  const env = loadEnv(envMode, process.cwd(), "ASTRO_STUDIO_");
  return env;
}
function getAstroStudioUrl() {
  const env = getAstroStudioEnv();
  return env.ASTRO_STUDIO_URL || "https://studio.astro.build";
}
export {
  getAstroStudioEnv,
  getAstroStudioUrl
};
