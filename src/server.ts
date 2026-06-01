import express from "express";

import { connectToDb } from "./impl/mongoose/connection";
import { MongooseDaoFactory } from "./impl/mongoose/dao/MongooseDaoFactory";
import { CreditTransactionService } from "./impl/service/CreditTransactionService";
import { OrganizationCreditService } from "./impl/service/OrganizationCreditService";
import { EnvConfigReader } from "./impl/service/EnvConfigReader";
import {
  maskMongoUri,
  mongoUriHasCredentials,
} from "./impl/mongoose/resolveMongoConfig";

const PORT = Number(process.env.PORT || 3100);
const API_PREFIX = "/api/user-credits";

function parseMemberUserIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getExpectedApiKey(): string {
  return String(process.env.USER_CREDITS_HTTP_API_KEY || "").trim();
}

function assertApiKey(
  req: express.Request,
  res: express.Response,
): boolean {
  const expected = getExpectedApiKey();
  if (!expected) return true;
  const incoming = String(req.headers["x-api-key"] || "").trim();
  if (incoming !== expected) {
    res.status(401).json({ error: "Invalid API key" });
    return false;
  }
  return true;
}

function readPositiveNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return parsed;
}

export function createCreditTransactionApp(
  transactionService: CreditTransactionService,
  organizationCreditService?: OrganizationCreditService,
) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({
      ok: true,
      service: "user-credits-transaction-server",
      userIdFormat: "email",
    });
  });

  app.get(`${API_PREFIX}/balance/:userId`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const data = await transactionService.loadUserCredits(req.params.userId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to load user credit balance",
      });
    }
  });

  app.get(`${API_PREFIX}/transactions/:userId`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const limit = Number(req.query.limit || 100);
      const data = await transactionService.loadTransactionHistory(
        req.params.userId,
        Number.isFinite(limit) ? limit : 100,
      );
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to load transaction history",
      });
    }
  });

  app.post(`${API_PREFIX}/transactions/token-purchase`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const { credits, metadata, offerGroup, orderId, reason, userId } =
        req.body || {};
      const result = await transactionService.addCreditsFromPurchase(
        String(userId || ""),
        String(offerGroup || ""),
        readPositiveNumber(credits, "credits"),
        {
          metadata,
          reason:
            reason ||
            "User purchased new tokens",
          referenceId: orderId ? String(orderId) : undefined,
        },
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to add credits from token purchase",
      });
    }
  });

  app.post(`${API_PREFIX}/transactions/job-consumption`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const { credits, jobId, metadata, offerGroup, reason, userId } =
        req.body || {};
      const result = await transactionService.deductCreditsForJob(
        String(userId || ""),
        String(offerGroup || ""),
        readPositiveNumber(credits, "credits"),
        {
          metadata,
          reason:
            reason ||
            "User performed a billable job",
          referenceId: jobId ? String(jobId) : undefined,
        },
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to deduct credits for job consumption",
      });
    }
  });

  app.post(`${API_PREFIX}/transactions/allocate`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const { credits, metadata, offerGroup, reason, referenceId, userId } =
        req.body || {};
      const result = await transactionService.allocateCredits(
        String(userId || ""),
        String(offerGroup || ""),
        readPositiveNumber(credits, "credits"),
        {
          metadata,
          reason: reason || "Credits allocated to user account",
          referenceId: referenceId ? String(referenceId) : undefined,
        },
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to allocate credits",
      });
    }
  });

  app.post(`${API_PREFIX}/transactions/adjust`, async (req, res) => {
    if (!assertApiKey(req, res)) return;
    try {
      const { delta, metadata, offerGroup, reason, referenceId, userId } =
        req.body || {};
      const parsedDelta = Number(delta);
      if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
        throw new Error("delta must be a non-zero number");
      }
      const result = await transactionService.adjustCredits(
        String(userId || ""),
        String(offerGroup || ""),
        parsedDelta,
        {
          metadata,
          reason: reason || "Manual credit adjustment",
          referenceId: referenceId ? String(referenceId) : undefined,
        },
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({
        error: error?.message || "Failed to adjust credits",
      });
    }
  });

  if (organizationCreditService) {
    app.get(
      `${API_PREFIX}/balance/organization/:organizationCode`,
      async (req, res) => {
        if (!assertApiKey(req, res)) return;
        try {
          const organizationCode = String(req.params.organizationCode || "").trim();
          const offerGroup = String(req.query.offerGroup || "render").trim();
          const memberUserIds = parseMemberUserIds(req.query.memberUserIds);
          const data = await organizationCreditService.getOrganizationBalance(
            organizationCode,
            offerGroup,
            memberUserIds,
          );
          res.json({ success: true, data });
        } catch (error: any) {
          res.status(400).json({
            error: error?.message || "Failed to load organization balance",
          });
        }
      },
    );

    app.post(
      `${API_PREFIX}/organizations/:organizationCode/pool/add`,
      async (req, res) => {
        if (!assertApiKey(req, res)) return;
        try {
          const organizationCode = String(req.params.organizationCode || "").trim();
          const { credits, offerGroup } = req.body || {};
          const data = await organizationCreditService.addToOrganizationPool(
            organizationCode,
            String(offerGroup || "render"),
            readPositiveNumber(credits, "credits"),
          );
          res.json({ success: true, data });
        } catch (error: any) {
          res.status(400).json({
            error: error?.message || "Failed to add credits to organization pool",
          });
        }
      },
    );

    app.post(`${API_PREFIX}/transactions/reallocate`, async (req, res) => {
      if (!assertApiKey(req, res)) return;
      try {
        const {
          credits,
          fromUserId,
          metadata,
          offerGroup,
          organizationCode,
          reason,
          referenceId,
          toUserId,
        } = req.body || {};
        const data = await organizationCreditService.reallocateCredits({
          fromUserId: String(fromUserId || ""),
          toUserId: String(toUserId || ""),
          offerGroup: String(offerGroup || "render"),
          credits: readPositiveNumber(credits, "credits"),
          organizationCode: String(organizationCode || ""),
          reason,
          referenceId: referenceId ? String(referenceId) : undefined,
          metadata,
        });
        res.json({ success: true, data });
      } catch (error: any) {
        res.status(400).json({
          error: error?.message || "Failed to reallocate credits",
        });
      }
    });

    app.post(
      `${API_PREFIX}/organizations/:organizationCode/split-equal`,
      async (req, res) => {
        if (!assertApiKey(req, res)) return;
        try {
          const organizationCode = String(req.params.organizationCode || "").trim();
          const {
            force,
            memberUserIds,
            offerGroup,
            reason,
            referenceId,
            totalCredits,
          } = req.body || {};
          const data = await organizationCreditService.splitEqual({
            organizationCode,
            offerGroup: String(offerGroup || "render"),
            memberUserIds: parseMemberUserIds(memberUserIds),
            totalCredits:
              totalCredits != null
                ? readPositiveNumber(totalCredits, "totalCredits")
                : undefined,
            force: Boolean(force),
            reason,
            referenceId: referenceId ? String(referenceId) : undefined,
          });
          res.json({ success: true, data });
        } catch (error: any) {
          res.status(400).json({
            error: error?.message || "Failed to split organization credits equally",
          });
        }
      },
    );
  }

  return app;
}

export async function bootstrap() {
  if (
    process.env.NODE_ENV === "production" &&
    !getExpectedApiKey()
  ) {
    throw new Error(
      "USER_CREDITS_HTTP_API_KEY is required when NODE_ENV=production",
    );
  }

  const config = new EnvConfigReader();
  const credsInUri = mongoUriHasCredentials(config.dbUrl);
  console.log(
    `[user-credits] MongoDB dbName=${config.dbName} uri=${maskMongoUri(config.dbUrl)} authInUri=${credsInUri}`,
  );
  if (process.env.NODE_ENV === "production" && !credsInUri) {
    throw new Error(
      "MONGODB_URI must include username and password (e.g. mongodb://user:pass@host:27017/?authSource=admin). " +
        "Copy the same authenticated URI used by UnifiedDataServer, or set DB_URL with credentials.",
    );
  }

  const connection = await connectToDb(config.dbUrl, config.dbName);
  const daoFactory = new MongooseDaoFactory(connection);
  const transactionService = new CreditTransactionService(daoFactory);
  const organizationCreditService = new OrganizationCreditService(
    daoFactory,
    transactionService,
  );
  const app = createCreditTransactionApp(
    transactionService,
    organizationCreditService,
  );

  app.listen(PORT, () => {
    console.log(
      `[user-credits] transaction server running at http://0.0.0.0:${PORT}${API_PREFIX}`,
    );
  });
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error) => {
    console.error("[user-credits] failed to start transaction server:", error);
    process.exit(1);
  });
}
