export type MongoConnectionConfig = {
  dbName: string;
  dbUrl: string;
};

/**
 * Resolves Mongo connection settings for the transaction server.
 *
 * Prefers MONGODB_URI (same env var as UnifiedDataServer) and uses DB_NAME to
 * select the user-credits database on the shared cluster. Falls back to DB_URL.
 */
export function resolveMongoConfig(
  env: NodeJS.ProcessEnv = process.env,
): MongoConnectionConfig {
  const mongoUri = String(env.MONGODB_URI || "").trim();
  const dbUrlEnv = String(env.DB_URL || "").trim();
  const dbNameEnv = String(env.DB_NAME || "").trim();

  if (mongoUri) {
    return {
      dbName: dbNameEnv || "user_credits",
      dbUrl: mongoUri,
    };
  }

  return {
    dbName: dbNameEnv || "user_credits",
    dbUrl: dbUrlEnv || "mongodb://localhost:27017",
  };
}
