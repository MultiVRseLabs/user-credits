import { normalizeCreditsUserId } from "../../lib/creditsUserId";

import { CreditTransactionType } from "../mongoose/model/CreditTransactionLog";

import { MongooseDaoFactory } from "../mongoose/dao/MongooseDaoFactory";
import { UserCreditsDao } from "../mongoose/dao/UserCreditsDao";



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

  userId: string;

};



export type CreditTransactionContext = {

  metadata?: Record<string, unknown>;

  reason?: string;

  referenceId?: string;

  transactionType: CreditTransactionType;

};



export type CreditTransactionResult = {

  balanceAfter: number;

  balanceBefore: number;

  credits: UserCreditsDocument;

  logId: string;

};



export class CreditTransactionService {

  constructor(private readonly daoFactory: MongooseDaoFactory) {}



  async loadUserCredits(userId: string) {

    const normalizedUserId = this.parseUserId(userId);

    const userCreditsDao = this.daoFactory.getUserCreditsDao() as unknown as UserCreditsDao;
    return await userCreditsDao.findByUserId(normalizedUserId);

  }



  async loadTransactionHistory(userId: string, limit = 100) {

    const normalizedUserId = this.parseUserId(userId);

    return await this.daoFactory

      .getCreditTransactionLogDao()

      .findByUserId(normalizedUserId, limit);

  }



  async addCreditsFromPurchase(

    userId: string,

    offerGroup: string,

    credits: number,

    context: Omit<CreditTransactionContext, "transactionType"> = {},

  ) {

    return this.applyTransaction(userId, offerGroup, Math.abs(credits), {

      ...context,

      transactionType: "token_purchase",

    });

  }



  async deductCreditsForJob(

    userId: string,

    offerGroup: string,

    credits: number,

    context: Omit<CreditTransactionContext, "transactionType"> = {},

  ) {

    return this.applyTransaction(userId, offerGroup, -Math.abs(credits), {

      ...context,

      transactionType: "job_consumption",

    });

  }



  async allocateCredits(

    userId: string,

    offerGroup: string,

    credits: number,

    context: Omit<CreditTransactionContext, "transactionType"> = {},

  ) {

    return this.applyTransaction(userId, offerGroup, Math.abs(credits), {

      ...context,

      transactionType: "allocation",

    });

  }



  async adjustCredits(

    userId: string,

    offerGroup: string,

    delta: number,

    context: Omit<CreditTransactionContext, "transactionType"> = {},

  ) {

    return this.applyTransaction(userId, offerGroup, delta, {

      ...context,

      transactionType: "adjustment",

    });

  }



  private async applyTransaction(

    userId: string,

    offerGroup: string,

    delta: number,

    context: CreditTransactionContext,

  ): Promise<CreditTransactionResult> {

    const sanitizedGroup = String(offerGroup || "").trim();

    if (!sanitizedGroup) {

      throw new Error("offerGroup is required");

    }

    if (!Number.isFinite(delta) || delta === 0) {

      throw new Error("credits delta must be a non-zero number");

    }



    const normalizedUserId = this.parseUserId(userId);

    const userCreditsDao = this.daoFactory.getUserCreditsDao() as unknown as UserCreditsDao;

    const tokenTimetableDao = this.daoFactory.getTokenTimetableDao() as any;

    const transactionLogDao = this.daoFactory.getCreditTransactionLogDao();



    let document = (await userCreditsDao.findOne({

      userId: normalizedUserId,

    })) as UserCreditsDocument | null;



    if (!document) {

      if (delta < 0) {

        throw new Error("Cannot deduct credits from an empty account");

      }

      document = (await userCreditsDao.create({

        offers: [],

        subscriptions: [],

        userId: normalizedUserId,

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

      document.offers.push({

        offerGroup: sanitizedGroup,

        starts: new Date(),

        tokens: 0,

      });

      bucket = document.offers[document.offers.length - 1];

    }



    const balanceBefore = Number(bucket.tokens || 0);

    const balanceAfter = balanceBefore + delta;

    if (balanceAfter < 0) {

      throw new Error(

        `Insufficient credits for offerGroup '${sanitizedGroup}'. current=${balanceBefore}, requestedDelta=${delta}`,

      );

    }



    bucket.tokens = balanceAfter;

    bucket.starts = bucket.starts || new Date();

    document.markModified("offers");

    await document.save();



    await tokenTimetableDao.create({

      offerGroup: sanitizedGroup,

      tokens: delta,

      userId: normalizedUserId,

    });



    const logEntry = await transactionLogDao.create({

      balanceAfter,

      balanceBefore,

      credits: delta,

      metadata: context.metadata,

      offerGroup: sanitizedGroup,

      reason: context.reason,

      referenceId: context.referenceId,

      transactionType: context.transactionType,

      userId: normalizedUserId,

    });



    return {

      balanceAfter,

      balanceBefore,

      credits: document,

      logId: String((logEntry as any)._id),

    };

  }



  private parseUserId(userId: string): string {
    return normalizeCreditsUserId(userId);
  }

}

