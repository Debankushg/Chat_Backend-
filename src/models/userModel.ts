import { pool } from "../config/database";
import { User } from "./types";

export async function insertUser(name: string): Promise<User> {
  const { rows } = await pool.query<User>(
    `INSERT INTO users (name) VALUES ($1) RETURNING id, name, created_at AS "createdAt"`,
    [name],
  );
  return rows[0] as User;
}

export async function findExistingIds(ids: string[]): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM users WHERE id = ANY($1::uuid[])`, [ids]);
  return rows.map((r) => r.id);
}

export async function userExists(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}
