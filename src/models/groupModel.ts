import { pool } from "../config/database";
import { GroupMember, GroupRole } from "./types";

export interface GroupRow {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export async function insertGroup(creatorId: string, name: string, memberIds: string[]): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO chats (type, name, created_by) VALUES ('group', $1, $2) RETURNING id`,
      [name, creatorId],
    );
    const groupId = (rows[0] as { id: string }).id;
    await client.query(`INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin')`, [
      groupId,
      creatorId,
    ]);
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role) SELECT $1, unnest($2::uuid[]), 'member'`,
      [groupId, memberIds],
    );
    await client.query("COMMIT");
    return groupId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Returns the chat row for any chat type (so callers can tell "not a group" from "not found"). */
export async function findChat(id: string): Promise<GroupRow | null> {
  const { rows } = await pool.query<GroupRow>(
    `SELECT id, type, name, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM chats WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { rows } = await pool.query<GroupMember>(
    `SELECT m.user_id AS "userId", u.name, m.role, m.joined_at AS "joinedAt"
       FROM chat_members m JOIN users u ON u.id = m.user_id
      WHERE m.chat_id = $1
      ORDER BY m.joined_at, u.name`,
    [groupId],
  );
  return rows;
}

export async function getRole(groupId: string, userId: string): Promise<GroupRole | null> {
  const { rows } = await pool.query<{ role: GroupRole }>(
    `SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  return rows[0]?.role ?? null;
}

export async function countAdmins(groupId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM chat_members WHERE chat_id = $1 AND role = 'admin'`,
    [groupId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await pool.query(`UPDATE chats SET name = $2, updated_at = now() WHERE id = $1`, [groupId, name]);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await pool.query(`DELETE FROM chats WHERE id = $1 AND type = 'group'`, [groupId]);
}

export async function insertMember(groupId: string, userId: string): Promise<void> {
  await pool.query(`INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member')`, [groupId, userId]);
}

export async function deleteMember(groupId: string, userId: string): Promise<void> {
  await pool.query(`DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2`, [groupId, userId]);
}

export async function updateRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
  await pool.query(`UPDATE chat_members SET role = $3 WHERE chat_id = $1 AND user_id = $2`, [groupId, userId, role]);
}
