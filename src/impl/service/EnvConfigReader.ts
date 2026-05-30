import dotenv from "dotenv";



import { IConfigReader } from "../../service/config/IConfigReader";

import { resolveMongoConfig } from "../mongoose/resolveMongoConfig";



dotenv.config(); // Load environment variables from a .env file



/**

 * This is one possible implementation for configuration reading.

 * If your project doesn't read environment variables from .env, feel free to implement your own IConfigReader and store

 * it as <code>configReader</code> in the Awilix container.

 */

export class EnvConfigReader implements IConfigReader {

  private readonly defaultCurrency: string;

  private readonly apiVersion: string;

  private readonly publicKey: string;

  private readonly privateKey: string;

  private readonly _dbUrl: string;

  private readonly _dbName: string;



  constructor() {

    const strictDbEnv =

      process.env.NODE_ENV === "production" ||

      String(process.env.REQUIRE_EXPLICIT_DB_ENV || "").toLowerCase() ===

        "true";



    this.publicKey = process.env.PUBLIC_STRIPE_KEY || "";

    this.privateKey = process.env.PRIVATE_STRIPE_KEY || "";

    this.apiVersion = process.env.PRIVATE_STRIPE_API_VERSION || "2023-08-16";

    this.defaultCurrency = process.env.CURRENCY || "usd";



    const mongoUri = String(process.env.MONGODB_URI || "").trim();
    const dbUrlEnv = String(process.env.DB_URL || "").trim();

    if (strictDbEnv && !mongoUri && !dbUrlEnv) {

      throw new Error(

        "MONGODB_URI or DB_URL is required when NODE_ENV=production or REQUIRE_EXPLICIT_DB_ENV=true",

      );

    }



    const resolved = resolveMongoConfig();

    this._dbName = resolved.dbName;

    this._dbUrl = resolved.dbUrl;

  }

  get dbUrl(): string {

    return this._dbUrl;

  }



  get dbName(): string {

    return this._dbName;

  }



  get currency(): string {

    return this.defaultCurrency;

  }



  get paymentApiVersion(): string {

    return this.apiVersion;

  }



  get paymentPublicKey(): string {

    return this.publicKey;

  }



  get paymentSecretKey(): string {

    return this.privateKey;

  }

}

