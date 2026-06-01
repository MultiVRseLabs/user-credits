import { Connection } from "mongoose";

import { IBaseEntity } from "@user-credits/core";
import { Types } from "mongoose";

import organizationCreditsSchema, {
  IOrganizationCredits,
  IMongooseOrganizationCredits,
} from "../model/OrganizationCredits";
import { BaseMongooseDao } from "./BaseMongooseDao";

type OrganizationCreditsEntity = IOrganizationCredits &
  IBaseEntity<Types.ObjectId>;

export class OrganizationCreditsDao extends BaseMongooseDao<
  IMongooseOrganizationCredits,
  OrganizationCreditsEntity
> {
  constructor(connection: Connection) {
    super(connection, organizationCreditsSchema, "organization_credits");
  }

  async findByOrgAndOfferGroup(
    organizationCode: string,
    offerGroup: string,
  ): Promise<IMongooseOrganizationCredits | null> {
    return this.findOne({ organizationCode, offerGroup });
  }

  async upsertPool(
    organizationCode: string,
    offerGroup: string,
    patch: Partial<IMongooseOrganizationCredits>,
  ): Promise<IMongooseOrganizationCredits> {
    const existing = await this.findByOrgAndOfferGroup(organizationCode, offerGroup);
    if (existing) {
      Object.assign(existing, patch);
      await (existing as any).save();
      return existing;
    }
    return this.create({
      organizationCode,
      offerGroup,
      totalPurchased: 0,
      totalAllocated: 0,
      allocationVersion: 0,
      ...patch,
    } as IMongooseOrganizationCredits);
  }
}
