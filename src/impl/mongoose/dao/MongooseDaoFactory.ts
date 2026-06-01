import { Connection, Types } from "mongoose";
type ObjectId = Types.ObjectId;

import {
  IDaoFactory,
  IOffer,
  IOfferDao,
  IOrder,
  IOrderDao,
  ITokenTimetable,
  ITokenTimetableDao,
  IUserCredits,
  IUserCreditsDao,
} from "@user-credits/core";

import { OfferDao } from "./OfferDao";
import { OrderDao } from "./OrderDao";
import { TokenTimetableDao } from "./TokenTimetableDao";
import { UserCreditsDao } from "./UserCreditsDao";
import { CreditTransactionLogDao } from "./CreditTransactionLogDao";
import { OrganizationCreditsDao } from "./OrganizationCreditsDao";

export class MongooseDaoFactory implements IDaoFactory<ObjectId> {
  private readonly creditTransactionLogDao;
  private readonly offerDao;
  private readonly orderDao;
  private readonly organizationCreditsDao;
  private readonly tokenTimetableDao;
  private readonly userCreditsDao;

  constructor(public connection: Connection) {
    this.creditTransactionLogDao = new CreditTransactionLogDao(connection);
    this.offerDao = new OfferDao(connection);
    this.orderDao = new OrderDao(connection);
    this.organizationCreditsDao = new OrganizationCreditsDao(connection);
    this.tokenTimetableDao = new TokenTimetableDao(connection);
    this.userCreditsDao = new UserCreditsDao(connection);
  }

  getOfferDao(): IOfferDao<ObjectId, IOffer<ObjectId>> {
    return this.offerDao;
  }

  getOrderDao(): IOrderDao<ObjectId, IOrder<ObjectId>> {
    return this.orderDao;
  }

  getTokenTimetableDao(): ITokenTimetableDao<
    ObjectId,
    ITokenTimetable<ObjectId>
  > {
    return this.tokenTimetableDao;
  }

  getUserCreditsDao(): IUserCreditsDao<ObjectId, IUserCredits<ObjectId>> {
    return this.userCreditsDao;
  }

  getCreditTransactionLogDao(): CreditTransactionLogDao {
    return this.creditTransactionLogDao;
  }

  getOrganizationCreditsDao(): OrganizationCreditsDao {
    return this.organizationCreditsDao;
  }
}
