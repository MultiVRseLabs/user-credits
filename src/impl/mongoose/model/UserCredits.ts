import type { IActivatedOffer, ISubscription } from "@user-credits/core";
import { IBaseEntity } from "@user-credits/core";
import { Document, Model, Schema, Types } from "mongoose";

import type { ObjectId } from "../TypeDefs";

/** Persisted user-credits account (userId = normalized ERP email). */
export type UserCreditsRecord = {
  offers: IActivatedOffer[];
  subscriptions: ISubscription<ObjectId>[];
  userId: string;
};

export type IMongooseUserCredits = UserCreditsRecord & Document;

export type UserCreditsEntity = UserCreditsRecord & IBaseEntity<ObjectId>;

const subscriptionSchema = new Schema<
  ISubscription<ObjectId>,
  Model<ISubscription<ObjectId>>
>({
  currency: String,
  cycle: {
    enum: [
      "once",
      "daily",
      "weekly",
      "bi-weekly",
      "monthly",
      "trimester",
      "semester",
      "yearly",
      "custom",
    ],
    type: String,
  },
  expires: Date,
  name: { required: true, type: String },
  offerGroup: { required: true, type: String },
  offerId: {
    ref: "offer",
    required: true,
    type: Schema.Types.ObjectId,
  },
  orderId: {
    ref: "order",
    required: true,
    type: Schema.Types.ObjectId,
  },
  quantity: Number,
  starts: Date,
  status: {
    enum: [
      "pending",
      "paid",
      "refused",
      "error",
      "inconsistent",
      "partial",
      "expired",
    ],
    required: true,
    type: String,
  },
  tokens: { type: Number },
  total: Number,
});

const activatedOfferSchema = new Schema<
  IActivatedOffer,
  Model<IActivatedOffer>
>({
  expires: Date,
  offerGroup: { required: true, type: String },
  starts: Date,
  tokens: { type: Number },
});

const userCreditsSchema = new Schema<IMongooseUserCredits>(
  {
    offers: [activatedOfferSchema],
    subscriptions: [subscriptionSchema],
    userId: {
      required: true,
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: true },
);

export default userCreditsSchema;
