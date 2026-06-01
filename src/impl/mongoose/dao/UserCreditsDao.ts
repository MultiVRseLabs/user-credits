import { Connection } from "mongoose";

import { UserCredits } from "../model";
import {
  IMongooseUserCredits,
  UserCreditsEntity,
} from "../model/UserCredits";
import { BaseMongooseDao } from "./BaseMongooseDao";

export class UserCreditsDao extends BaseMongooseDao<
  IMongooseUserCredits,
  UserCreditsEntity
> {
  constructor(connection: Connection) {
    super(connection, UserCredits, "user_credits");
  }

  findByUserId(userId: string): Promise<IMongooseUserCredits | null> {
    return super.findOne({ userId });
  }
}
