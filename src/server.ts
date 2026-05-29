import express from "express";

import { connectToDb } from "./impl/mongoose/connection";
import { MongooseDaoFactory } from "./impl/mongoose/dao/MongooseDaoFactory";
import { CreditTransactionService } from "./impl/service/CreditTransactionService";
import { EnvConfigReader } from "./impl/service/EnvConfigReader";

const PORT = Number(process.env.PORT || 3100);

function assertWriteApiKey(
  req: express.Request,
  res: express.Response,
): boolean {
  const expected = String(process.env.USER_CREDITS_HTTP_API_KEY || "").trim();
  if (!expected) return true;
  const incoming = String(req.headers["x-api-key"] || "").trim();
  if (incoming !== expected) {
    res.status(401).json({ error: "Invalid API key" });
    return false;
  }
  return true;
}

export function createCreditTransactionApp(
  transactionService: CreditTransactionService,
) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "user-credits-transaction-server" });
  });

  app.get("/credits/:userId", async (req, res) => {
    try {
      const data = await transactionService.loadUserCredits(req.params.userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to load user credits" });
    }
  });

  app.post("/credits/consume", async (req, res) => {
    if (!assertWriteApiKey(req, res)) return;
    try {
      const { userId, offerGroup, count } = req.body || {};
      const data = await transactionService.consumeCredits(
        String(userId || ""),
        String(offerGroup || ""),
        Number(count),
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to consume credits" });
    }
  });

  app.post("/credits/add", async (req, res) => {
    if (!assertWriteApiKey(req, res)) return;
    try {
      const { userId, offerGroup, count } = req.body || {};
      const data = await transactionService.addCredits(
        String(userId || ""),
        String(offerGroup || ""),
        Number(count),
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to add credits" });
    }
  });

  app.post("/credits/adjust", async (req, res) => {
    if (!assertWriteApiKey(req, res)) return;
    try {
      const { userId, offerGroup, delta } = req.body || {};
      const data = await transactionService.adjustCredits(
        String(userId || ""),
        String(offerGroup || ""),
        Number(delta),
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to adjust credits" });
    }
  });

  return app;
}

export async function bootstrap() {
  const config = new EnvConfigReader();
  const connection = await connectToDb(config.dbUrl, config.dbName);
  const daoFactory = new MongooseDaoFactory(connection);
  const transactionService = new CreditTransactionService(daoFactory);
  const app = createCreditTransactionApp(transactionService);

  app.listen(PORT, () => {
    console.log(`[user-credits] HTTP wrapper running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error) => {
    console.error("[user-credits] failed to start wrapper:", error);
    process.exit(1);
  });
}
