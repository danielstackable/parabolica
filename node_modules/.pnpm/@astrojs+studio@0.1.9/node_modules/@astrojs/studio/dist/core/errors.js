import { cyan, red } from "kleur/colors";
const MISSING_SESSION_ID_CI_ERROR = `${red("\u25B6 ASTRO_STUDIO_APP_TOKEN required")}

	To authenticate with Astro Studio add the token to your CI's environment variables.
`;
const MISSING_SESSION_ID_ERROR = `${red("\u25B6 Login required!")}

  To authenticate with Astro Studio, run
  ${cyan("astro login")}
`;
const MISSING_PROJECT_ID_ERROR = `${red("\u25B6 Directory not linked.")}

  To link this directory to an Astro Studio project, run
  ${cyan("astro link")}
`;
export {
  MISSING_PROJECT_ID_ERROR,
  MISSING_SESSION_ID_CI_ERROR,
  MISSING_SESSION_ID_ERROR
};
