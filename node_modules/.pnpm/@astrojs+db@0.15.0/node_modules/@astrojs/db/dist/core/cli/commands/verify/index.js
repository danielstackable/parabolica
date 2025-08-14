import { getManagedRemoteToken, getRemoteDatabaseInfo } from "../../../utils.js";
import {
  createCurrentSnapshot,
  createEmptySnapshot,
  formatDataLossMessage,
  getMigrationQueries,
  getProductionCurrentSnapshot
} from "../../migration-queries.js";
async function cmd({
  dbConfig,
  flags
}) {
  const isJson = flags.json;
  const dbInfo = getRemoteDatabaseInfo();
  const appToken = await getManagedRemoteToken(flags.token, dbInfo);
  const productionSnapshot = await getProductionCurrentSnapshot({
    dbInfo,
    appToken: appToken.token
  });
  const currentSnapshot = createCurrentSnapshot(dbConfig);
  const { queries: migrationQueries, confirmations } = await getMigrationQueries({
    oldSnapshot: productionSnapshot || createEmptySnapshot(),
    newSnapshot: currentSnapshot
  });
  const result = { exitCode: 0, message: "", code: "", data: void 0 };
  if (migrationQueries.length === 0) {
    result.code = "MATCH";
    result.message = `Database schema is up to date.`;
  } else {
    result.code = "NO_MATCH";
    result.message = `Database schema is out of date.
Run 'astro db push' to push up your latest changes.`;
  }
  if (confirmations.length > 0) {
    result.code = "DATA_LOSS";
    result.exitCode = 1;
    result.data = confirmations;
    result.message = formatDataLossMessage(confirmations, !isJson);
  }
  if (isJson) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result.message);
  }
  await appToken.destroy();
  process.exit(result.exitCode);
}
export {
  cmd
};
