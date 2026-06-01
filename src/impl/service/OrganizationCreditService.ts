import { MongooseDaoFactory } from "../mongoose/dao/MongooseDaoFactory";
import { normalizeCreditsUserId } from "../../lib/creditsUserId";
import { CreditTransactionService } from "./CreditTransactionService";

export type OrganizationBalanceMember = {
  balance: number;
  userId: string;
};

export type OrganizationBalanceResult = {
  allocationVersion: number;
  members: OrganizationBalanceMember[];
  offerGroup: string;
  organizationCode: string;
  totalAllocated: number;
  totalPurchased: number;
  unallocated: number;
};

export class OrganizationCreditService {
  constructor(
    private readonly daoFactory: MongooseDaoFactory,
    private readonly transactionService: CreditTransactionService,
  ) {}

  private parseUserId(userId: string): string {
    return normalizeCreditsUserId(userId);
  }

  private getOrgDao() {
    return this.daoFactory.getOrganizationCreditsDao();
  }

  private async getUserBalance(userId: string, offerGroup: string): Promise<number> {
    const doc = await this.transactionService.loadUserCredits(userId);
    if (!doc || !Array.isArray((doc as any).offers)) return 0;
    const bucket = (doc as any).offers.find(
      (entry: { offerGroup: string }) => entry.offerGroup === offerGroup,
    );
    return Number(bucket?.tokens || 0);
  }

  async getOrganizationBalance(
    organizationCode: string,
    offerGroup: string,
    memberUserIds: string[] = [],
  ): Promise<OrganizationBalanceResult> {
    const orgCode = String(organizationCode || "").trim();
    const group = String(offerGroup || "").trim();
    if (!orgCode || !group) {
      throw new Error("organizationCode and offerGroup are required");
    }

    const poolDoc =
      (await this.getOrgDao().findByOrgAndOfferGroup(orgCode, group)) ||
      (await this.getOrgDao().upsertPool(orgCode, group, {}));

    const members: OrganizationBalanceMember[] = [];
    for (const rawUserId of memberUserIds) {
      const userId = String(rawUserId || "").trim();
      if (!userId) continue;
      this.parseUserId(userId);
      members.push({
        userId,
        balance: await this.getUserBalance(userId, group),
      });
    }

    const totalPurchased = Number(poolDoc.totalPurchased || 0);
    const totalAllocated = Number(poolDoc.totalAllocated || 0);

    return {
      organizationCode: orgCode,
      offerGroup: group,
      totalPurchased,
      totalAllocated,
      unallocated: Math.max(0, totalPurchased - totalAllocated),
      allocationVersion: Number(poolDoc.allocationVersion || 0),
      members,
    };
  }

  async addToOrganizationPool(
    organizationCode: string,
    offerGroup: string,
    credits: number,
  ) {
    const amount = Math.abs(Number(credits));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("credits must be a positive number");
    }

    const orgCode = String(organizationCode || "").trim();
    const group = String(offerGroup || "").trim();
    const poolDoc = await this.getOrgDao().upsertPool(orgCode, group, {});
    poolDoc.totalPurchased = Number(poolDoc.totalPurchased || 0) + amount;
    await (poolDoc as any).save();

    return this.getOrganizationBalance(orgCode, group);
  }

  async reallocateCredits(params: {
    fromUserId: string;
    toUserId: string;
    offerGroup: string;
    credits: number;
    organizationCode: string;
    reason?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const fromUserId = String(params.fromUserId || "").trim();
    const toUserId = String(params.toUserId || "").trim();
    const offerGroup = String(params.offerGroup || "").trim();
    const organizationCode = String(params.organizationCode || "").trim();
    const amount = Math.abs(Number(params.credits));

    if (!fromUserId || !toUserId || !offerGroup || !organizationCode) {
      throw new Error(
        "fromUserId, toUserId, offerGroup, and organizationCode are required",
      );
    }
    if (fromUserId === toUserId) {
      throw new Error("fromUserId and toUserId must differ");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("credits must be a positive number");
    }

    this.parseUserId(fromUserId);
    this.parseUserId(toUserId);

    const fromBalance = await this.getUserBalance(fromUserId, offerGroup);
    if (fromBalance < amount) {
      throw new Error(
        `Insufficient credits on source account. current=${fromBalance}, requested=${amount}`,
      );
    }

    const referenceId = params.referenceId
      ? String(params.referenceId)
      : `realloc-${Date.now()}`;

    await this.transactionService.adjustCredits(fromUserId, offerGroup, -amount, {
      reason: params.reason || "Organization credit reallocation (debit)",
      referenceId,
      metadata: {
        organizationCode,
        reallocateDirection: "out",
        counterpartyUserId: toUserId,
        ...(params.metadata || {}),
      },
    });

    await this.transactionService.allocateCredits(toUserId, offerGroup, amount, {
      reason: params.reason || "Organization credit reallocation (credit)",
      referenceId,
      metadata: {
        organizationCode,
        reallocateDirection: "in",
        counterpartyUserId: fromUserId,
        ...(params.metadata || {}),
      },
    });

    const poolDoc = await this.getOrgDao().upsertPool(organizationCode, offerGroup, {});
    poolDoc.allocationVersion = Number(poolDoc.allocationVersion || 0) + 1;
    await (poolDoc as any).save();

    return {
      referenceId,
      fromUserId,
      toUserId,
      credits: amount,
      organizationCode,
      offerGroup,
      allocationVersion: poolDoc.allocationVersion,
    };
  }

  async splitEqual(params: {
    organizationCode: string;
    offerGroup: string;
    memberUserIds: string[];
    totalCredits?: number;
    force?: boolean;
    reason?: string;
    referenceId?: string;
  }) {
    const organizationCode = String(params.organizationCode || "").trim();
    const offerGroup = String(params.offerGroup || "").trim();
    const memberUserIds = (params.memberUserIds || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    if (!organizationCode || !offerGroup) {
      throw new Error("organizationCode and offerGroup are required");
    }
    if (memberUserIds.length === 0) {
      throw new Error("memberUserIds must contain at least one userId");
    }

    for (const userId of memberUserIds) {
      this.parseUserId(userId);
    }

    const poolDoc = await this.getOrgDao().upsertPool(organizationCode, offerGroup, {});
    const allocationVersion = Number(poolDoc.allocationVersion || 0);
    if (allocationVersion > 0 && !params.force) {
      throw new Error(
        "Organization credits were manually reallocated; pass force=true to split anyway",
      );
    }

    const unallocated = Math.max(
      0,
      Number(poolDoc.totalPurchased || 0) - Number(poolDoc.totalAllocated || 0),
    );
    const creditsToSplit =
      params.totalCredits != null ? Math.abs(Number(params.totalCredits)) : unallocated;

    if (!Number.isFinite(creditsToSplit) || creditsToSplit <= 0) {
      throw new Error("No credits available to split");
    }
    if (creditsToSplit > unallocated) {
      throw new Error(
        `Cannot split ${creditsToSplit} credits; only ${unallocated} unallocated in pool`,
      );
    }

    const perMember = Math.floor(creditsToSplit / memberUserIds.length);
    if (perMember <= 0) {
      throw new Error("Split amount too small for the number of members");
    }

    const referenceId = params.referenceId
      ? String(params.referenceId)
      : `split-${organizationCode}-${Date.now()}`;

    const allocations: OrganizationBalanceMember[] = [];
    for (const userId of memberUserIds) {
      await this.transactionService.allocateCredits(userId, offerGroup, perMember, {
        reason: params.reason || "Equal organization credit split",
        referenceId,
        metadata: {
          organizationCode,
          splitEqual: true,
          memberCount: memberUserIds.length,
        },
      });
      allocations.push({
        userId,
        balance: await this.getUserBalance(userId, offerGroup),
      });
    }

    const allocatedTotal = perMember * memberUserIds.length;
    poolDoc.totalAllocated = Number(poolDoc.totalAllocated || 0) + allocatedTotal;
    await (poolDoc as any).save();

    return {
      organizationCode,
      offerGroup,
      perMember,
      allocatedTotal,
      remainderInPool: creditsToSplit - allocatedTotal,
      referenceId,
      members: allocations,
      pool: await this.getOrganizationBalance(organizationCode, offerGroup),
    };
  }
}
