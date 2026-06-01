import { IBaseEntity } from "@user-credits/core";
import { Document, Schema, Types } from "mongoose";

/** Token consumption ledger row (userId = normalized ERP email). */
export type TokenTimetableRecord = {
  offerGroup: string;
  tokens: number;
  userId: string;
};

export type IMongooseTokenTimetable = TokenTimetableRecord & Document;

export type TokenTimetableEntity = TokenTimetableRecord &
  IBaseEntity<Types.ObjectId>;

const tokenTimetableSchema = new Schema<IMongooseTokenTimetable>(
  {
    offerGroup: String,
    tokens: { default: 0, required: true, type: Number },
    userId: {
      required: true,
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

tokenTimetableSchema.index({ offerGroup: 1, createdAt: 1, tokens: 1 });
tokenTimetableSchema.index({ createdAt: 1, tokens: 1 });

export default tokenTimetableSchema;
