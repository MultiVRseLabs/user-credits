import { Document, Schema, Types } from "mongoose";

export const CREDIT_TRANSACTION_TYPES = [
  "token_purchase",
  "job_consumption",
  "allocation",
  "adjustment",
] as const;

export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

export type ICreditTransactionLog = {
  balanceAfter: number;
  balanceBefore: number;
  credits: number;
  metadata?: Record<string, unknown>;
  offerGroup: string;
  reason?: string;
  referenceId?: string;
  transactionType: CreditTransactionType;
  userId: Types.ObjectId;
};

export type IMongooseCreditTransactionLog = ICreditTransactionLog & Document;

const creditTransactionLogSchema = new Schema<IMongooseCreditTransactionLog>(
  {
    balanceAfter: { required: true, type: Number },
    balanceBefore: { required: true, type: Number },
    credits: { required: true, type: Number },
    metadata: { type: Schema.Types.Mixed },
    offerGroup: { required: true, type: String },
    reason: { type: String },
    referenceId: { type: String },
    transactionType: {
      enum: CREDIT_TRANSACTION_TYPES,
      required: true,
      type: String,
    },
    userId: {
      required: true,
      type: Schema.Types.ObjectId,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

creditTransactionLogSchema.index({ createdAt: -1 });
creditTransactionLogSchema.index({ referenceId: 1 });
creditTransactionLogSchema.index({ transactionType: 1, createdAt: -1 });
creditTransactionLogSchema.index({ userId: 1, createdAt: -1 });

export default creditTransactionLogSchema;
