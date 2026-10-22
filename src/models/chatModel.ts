import { pool } from "../config/database";
import { ChatSummary } from "./types";

/** `a` and `b` must already be in canonical order (a < b). */
export async function upsertChat(a: string, b: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO chats (user_a_id, user_b_id) VALUES ($1, $2)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING RETURNING id`,
      [a, b],
    );
    let chatId = inserted.rows[0]?.id;
    if (chatId) {
      await client.query(`INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`, [chatId, a, b]);
    } else {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM chats WHERE user_a_id = $1 AND user_b_id = $2`,
        [a, b],
      );
      chatId = existing.rows[0]?.id;
    }
    await client.query("COMMIT");
    if (!chatId) throw new Error("Chat lookup failed after upsert");
    return chatId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function chatExists(chatId: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM chats WHERE id = $1`, [chatId]);
  return (rowCount ?? 0) > 0;
}

export async function isMember(chatId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2`, [
    chatId,
    userId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function findChatsByUser(userId: string): Promise<ChatSummary[]> {
  const { rows } = await pool.query<ChatSummary>(
    `SELECT c.id,
            c.type,
            c.name,
            c.created_at AS "createdAt",
            array_agg(m.user_id ORDER BY m.user_id) AS "memberIds"
       FROM chats c
       JOIN chat_members mine ON mine.chat_id = c.id AND mine.user_id = $1
       JOIN chat_members m    ON m.chat_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    [userId],
  );
  return rows;
}
