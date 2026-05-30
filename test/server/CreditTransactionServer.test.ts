import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AddressInfo } from "net";
import { Server } from "http";
import { Types } from "mongoose";

import { connectToDb, disconnectFromDb } from "../../src/impl/mongoose/connection";
import { MongooseDaoFactory } from "../../src/impl/mongoose/dao/MongooseDaoFactory";
import { CreditTransactionService } from "../../src/impl/service/CreditTransactionService";
import { createCreditTransactionApp } from "../../src/server";

const API_PREFIX = "/api/user-credits";

describe("Credit transaction server", () => {
  let mongoMemoryServer: MongoMemoryServer;
  let server: Server;
  let baseUrl: string;
  let transactionService: CreditTransactionService;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.USER_CREDITS_HTTP_API_KEY = "test-api-key";

    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const connection = await connectToDb(uri, "user_credits_server_test");
    const daoFactory = new MongooseDaoFactory(connection);
    transactionService = new CreditTransactionService(daoFactory);
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
    const response = await fetch(`${baseUrl}${API_PREFIX}/transactions/token-purchase`, {
      body: JSON.stringify({ credits: 10, offerGroup: "render", userId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Invalid API key");
  });

  it("validates payload and returns error for invalid userId", async () => {
    const response = await fetch(`${baseUrl}${API_PREFIX}/transactions/token-purchase`, {
      body: JSON.stringify({
        credits: 10,
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

  it("adds credits from token purchase then deducts for job consumption", async () => {
    const userId = new Types.ObjectId().toHexString();

    const purchaseResponse = await fetch(
      `${baseUrl}${API_PREFIX}/transactions/token-purchase`,
      {
        body: JSON.stringify({
          credits: 100,
          offerGroup: "render",
          orderId: "order-123",
          userId,
        }),
        headers: {
          "content-type": "application/json",
          "x-api-key": "test-api-key",
        },
        method: "POST",
      },
    );
    expect(purchaseResponse.status).toBe(200);
    const purchaseJson = await purchaseResponse.json();
    expect(purchaseJson.data.balanceAfter).toBe(100);

    const jobResponse = await fetch(
      `${baseUrl}${API_PREFIX}/transactions/job-consumption`,
      {
        body: JSON.stringify({
          credits: 70,
          jobId: "job-456",
          offerGroup: "render",
          userId,
        }),
        headers: {
          "content-type": "application/json",
          "x-api-key": "test-api-key",
        },
        method: "POST",
      },
    );
    expect(jobResponse.status).toBe(200);
    const jobJson = await jobResponse.json();
    expect(jobJson.data.balanceAfter).toBe(30);

    const readResponse = await fetch(`${baseUrl}${API_PREFIX}/balance/${userId}`, {
      headers: { "x-api-key": "test-api-key" },
    });
    const readJson = await readResponse.json();

    expect(readResponse.status).toBe(200);
    const offer = (readJson.data?.offers || []).find(
      (item: any) => item.offerGroup === "render",
    );
    expect(offer).toBeTruthy();
    expect(offer.tokens).toBe(30);
  });

  it("logs every transaction with type and reference metadata", async () => {
    const userId = new Types.ObjectId().toHexString();

    await fetch(`${baseUrl}${API_PREFIX}/transactions/token-purchase`, {
      body: JSON.stringify({
        credits: 50,
        offerGroup: "render",
        orderId: "order-789",
        userId,
      }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-api-key",
      },
      method: "POST",
    });

    await fetch(`${baseUrl}${API_PREFIX}/transactions/job-consumption`, {
      body: JSON.stringify({
        credits: 20,
        jobId: "job-789",
        offerGroup: "render",
        userId,
      }),
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-api-key",
      },
      method: "POST",
    });

    const historyResponse = await fetch(
      `${baseUrl}${API_PREFIX}/transactions/${userId}`,
      {
        headers: { "x-api-key": "test-api-key" },
      },
    );
    const historyJson = await historyResponse.json();

    expect(historyResponse.status).toBe(200);
    expect(historyJson.data).toHaveLength(2);

    const purchaseLog = historyJson.data.find(
      (entry: any) => entry.transactionType === "token_purchase",
    );
    const jobLog = historyJson.data.find(
      (entry: any) => entry.transactionType === "job_consumption",
    );

    expect(purchaseLog.referenceId).toBe("order-789");
    expect(purchaseLog.credits).toBe(50);
    expect(jobLog.referenceId).toBe("job-789");
    expect(jobLog.credits).toBe(-20);
  });
});
