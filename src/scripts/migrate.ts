import fs from "fs";
import path from "path";
import { pool } from "../config/database";

async function main(): Promise<void> {
  const dir = path.join(__dirname, "..", "..", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await pool.query(fs.readFileSync(path.join(dir, file), "utf8"));
    console.log(`applied ${file}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
