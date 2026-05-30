import { describe, expect, it } from "@jest/globals";

import { resolveMongoConfig } from "../../src/impl/mongoose/resolveMongoConfig";

describe("resolveMongoConfig", () => {
  it("prefers MONGODB_URI and applies DB_NAME override", () => {
    const config = resolveMongoConfig({
      DB_NAME: "user_credits",
      MONGODB_URI: "mongodb://localhost:27017/interia",
    });

    expect(config.dbUrl).toBe("mongodb://localhost:27017/interia");
    expect(config.dbName).toBe("user_credits");
  });

  it("falls back to DB_URL when MONGODB_URI is absent", () => {
    const config = resolveMongoConfig({
      DB_NAME: "user_credits",
      DB_URL: "mongodb://localhost:27017",
    });

    expect(config.dbUrl).toBe("mongodb://localhost:27017");
    expect(config.dbName).toBe("user_credits");
  });
});
