import { Types } from "mongoose";

import { MongooseDaoFactory } from "../mongoose/dao/MongooseDaoFactory";

type CreditOffer = {
  expires?: Date;
  offerGroup: string;
  starts?: Date;
  tokens?: number;
};

type UserCreditsDocument = {
  markModified: (path: string) => void;
  offers?: CreditOffer[];
  save: () => Promise<unknown>;
  subscriptions?: unknown[];
  userId: Types.ObjectId;
};

export class CreditTransactionService {
  constructor(private readonly daoFactory: MongooseDaoFactory) {}

  async loadUserCredits(userId: string) {
    const objectId = this.parseUserId(userId);
    return await this.daoFactory.getUserCreditsDao().findByUserId(objectId as any);
  }

  async consumeCredits(userId: string, offerGroup: string, count: number) {
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("count must be a positive number");
    }
    return this.adjustCredits(userId, offerGroup, -Math.abs(count));
  }

  async addCredits(userId: string, offerGroup: string, count: number) {
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("count must be a positive number");
    }
    return this.adjustCredits(userId, offerGroup, Math.abs(count));
  }

  async adjustCredits(userId: string, offerGroup: string, delta: number) {
    const sanitizedGroup = String(offerGroup || "").trim();
    if (!sanitizedGroup) {
      throw new Error("offerGroup is required");
    }
    if (!Number.isFinite(delta) || delta === 0) {
      throw new Error("delta must be a non-zero number");
    }

    const objectId = this.parseUserId(userId);
    const dao = this.daoFactory.getUserCreditsDao() as any;
    let document = (await dao.findOne({ userId: objectId })) as UserCreditsDocument | null;

    if (!document) {
      if (delta < 0) {
        throw new Error("Cannot consume credits from an empty account");
      }
      document = (await dao.create({
        offers: [],
        subscriptions: [],
        userId: objectId,
      })) as UserCreditsDocument;
    }

    if (!Array.isArray(document.offers)) {
      document.offers = [];
    }

    let bucket = document.offers.find((item) => item.offerGroup === sanitizedGroup);
    if (!bucket) {
      if (delta < 0) {
        throw new Error(`No credits available for offerGroup '${sanitizedGroup}'`);
      }
      bucket = {
        offerGroup: sanitizedGroup,
        starts: new Date(),
        tokens: 0,
      };
      document.offers.push(bucket);
    }

    const previous = Number(bucket.tokens || 0);
    const next = previous + delta;
    if (next < 0) {
      throw new Error(
        `Insufficient credits for offerGroup '${sanitizedGroup}'. current=${previous}, requestedDelta=${delta}`,
      );
    }

    bucket.tokens = next;
    bucket.starts = bucket.starts || new Date();
    document.markModified("offers");
    await document.save();

    return document;
  }

  private parseUserId(userId: string): Types.ObjectId {
    const value = String(userId || "").trim();
    if (!Types.ObjectId.isValid(value)) {
      throw new Error("userId must be a valid ObjectId string");
    }
    return new Types.ObjectId(value);
  }
}
