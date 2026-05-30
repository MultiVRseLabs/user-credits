import { IBaseEntity } from "@user-credits/core";
import { Connection, Types } from "mongoose";

import CreditTransactionLogSchema, {
  ICreditTransactionLog,
  IMongooseCreditTransactionLog,
} from "../model/CreditTransactionLog";
import { BaseMongooseDao } from "./BaseMongooseDao";

type CreditTransactionLogEntity = ICreditTransactionLog &
  IBaseEntity<Types.ObjectId>;

export class CreditTransactionLogDao extends BaseMongooseDao<
  IMongooseCreditTransactionLog,
  CreditTransactionLogEntity
> {
  constructor(connection: Connection) {
    super(connection, CreditTransactionLogSchema, "credit_transaction_log");
  }

  async findByUserId(
    userId: Types.ObjectId,
    limit = 100,
  ): Promise<IMongooseCreditTransactionLog[]> {
    return this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
