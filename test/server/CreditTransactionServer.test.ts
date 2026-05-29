import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AddressInfo } from "net";
import { Server } from "http";
import { Types } from "mongoose";

import { connectToDb, disconnectFromDb } from "../../src/impl/mongoose/connection";
import { MongooseDaoFactory } from "../../src/impl/mongoose/dao/MongooseDaoFactory";
import { CreditTransactionService } from "../../src/impl/service/CreditTransactionService";
import { createCreditTransactionApp } from "../../src/server";

describe("Credit transaction server", () => {
  let mongoMemoryServer: MongoMemoryServer;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.USER_CREDITS_HTTP_API_KEY = "test-api-key";

    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const connection = await connectToDb(uri, "user_credits_server_test");
    const daoFactory = new MongooseDaoFactory(connection);
    const transactionService = new CreditTransactionService(daoFactory);
    const app = createCreditTransactionApp(transactionService);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 60000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await disconnectFromDb();
    await mongoMemoryServer.stop();
  });

  it("rejects write requests without API key", async () => {
    const userId = new Types.ObjectId().toHexString();
    const response = await fetch(`${baseUrl}/credits/add`, {
      body: JSON.stringify({ count: 10, offerGroup: "render", userId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Invalid API key");
  });

  it("validates payload and returns error for invalid userId", async () => {
    const response = await fetch(`${baseUrl}/credits/add`, {
      body: JSON.stringify({
        count: 10,
        offerGroup: "render",
        userId: "not-object-id",
      }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-api-key",
      },
      method: "POST",
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(String(json.error || "")).toMatch("userId must be a valid ObjectId");
  });

  it("adds then consumes credits for a user", async () => {
    const userId = new Types.ObjectId().toHexString();

    const addResponse = await fetch(`${baseUrl}/credits/add`, {
      body: JSON.stringify({ count: 15, offerGroup: "render", userId }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-api-key",
      },
      method: "POST",
    });
    expect(addResponse.status).toBe(200);

    const consumeResponse = await fetch(`${baseUrl}/credits/consume`, {
      body: JSON.stringify({ count: 6, offerGroup: "render", userId }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-api-key",
      },
      method: "POST",
    });
    expect(consumeResponse.status).toBe(200);

    const readResponse = await fetch(`${baseUrl}/credits/${userId}`);
    const readJson = await readResponse.json();

    expect(readResponse.status).toBe(200);
    const offer = (readJson.data?.offers || []).find(
      (item: any) => item.offerGroup === "render",
    );
    expect(offer).toBeTruthy();
    expect(offer.tokens).toBe(9);
  });
});
