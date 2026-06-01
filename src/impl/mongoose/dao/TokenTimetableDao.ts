import { Connection } from "mongoose";

import { ConsumptionPerOfferGroup } from "@user-credits/core";

import { TokenTimetable } from "../model";
import {
  IMongooseTokenTimetable,
  TokenTimetableEntity,
} from "../model/TokenTimetable";
import { BaseMongooseDao } from "./BaseMongooseDao";

type MatchType = {
  createdAt: { $gte: Date; $lt: Date };
  tokens?: { $lt: number };
};

export class TokenTimetableDao extends BaseMongooseDao<
  IMongooseTokenTimetable,
  TokenTimetableEntity
> {
  constructor(connection: Connection) {
    super(connection, TokenTimetable, "token_timetable");
  }

  async consumptionInDateRange(
    offerGroup: string,
    startDate: Date,
    endDate: Date = new Date(),
  ): Promise<number> {
    const [result] = await this.model.aggregate([
      {
        $match: {
          offerGroup,
          createdAt: { $gte: startDate, $lt: endDate },
          tokens: { $lt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalNegativeTokens: { $sum: "$tokens" },
        },
      },
    ]);
    return result?.totalNegativeTokens ?? 0;
  }

  async checkTokens(
    startDate: Date,
    endDate: Date = new Date(),
    negative: boolean = true,
  ): Promise<[ConsumptionPerOfferGroup]> {
    const match: MatchType = {
      createdAt: { $gte: startDate, $lt: endDate },
    };

    if (negative) match.tokens = { $lt: 0 };

    const aggregate = this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$offerGroup",
          totalTokens: { $sum: "$tokens" },
        },
      },
    ]);

    return (await aggregate) as unknown as [ConsumptionPerOfferGroup];
  }
}
