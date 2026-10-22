import { Pool } from "pg";
import { config } from "./index";

export const pool = new Pool({ connectionString: config.databaseUrl });
