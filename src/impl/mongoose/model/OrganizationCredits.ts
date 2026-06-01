import { IBaseEntity } from "@user-credits/core";
import { Document, Schema, Types } from "mongoose";

export interface IOrganizationCredits {
  allocationVersion: number;
  offerGroup: string;
  organizationCode: string;
  totalAllocated: number;
  totalPurchased: number;
}

export type IMongooseOrganizationCredits = IOrganizationCredits &
  IBaseEntity<Types.ObjectId> &
  Document;

const organizationCreditsSchema = new Schema<IMongooseOrganizationCredits>(
  {
    organizationCode: { type: String, required: true, trim: true, index: true },
    offerGroup: { type: String, required: true, trim: true, index: true },
    totalPurchased: { type: Number, default: 0 },
    totalAllocated: { type: Number, default: 0 },
    allocationVersion: { type: Number, default: 0 },
  },
  {
    collection: "organization_credits",
    timestamps: true,
  },
);

organizationCreditsSchema.index(
  { organizationCode: 1, offerGroup: 1 },
  { unique: true },
);

export default organizationCreditsSchema;
