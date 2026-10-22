import { DocumentData, FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "../config/firebase";
import { toIso } from "../utils/time";
import { Message } from "./types";

/**
 * Firestore layout
 *   chats/{chatId}/messages/{messageId}  { senderId, text, createdAt, readBy: { [userId]: Timestamp } }
 *   chats/{chatId}/lastSeen/{userId}     { messageId, messageCreatedAt, updatedAt }
 */
const messagesRef = (chatId: string) => firestore.collection("chats").doc(chatId).collection("messages");
const lastSeenRef = (chatId: string, userId: string) =>
  firestore.collection("chats").doc(chatId).collection("lastSeen").doc(userId);

function toMessage(id: string, data: DocumentData): Message {
  const readBy: Record<string, string> = {};
  for (const [uid, ts] of Object.entries((data.readBy ?? {}) as Record<string, unknown>)) {
    const v = toIso(ts);
    if (v) readBy[uid] = v;
  }
  const deletedAt = toIso(data.deletedAt);
  return {
    id,
    senderId: data.senderId as string,
    text: deletedAt ? null : (data.text as string),
    createdAt: toIso(data.createdAt),
    editedAt: toIso(data.editedAt),
    deletedAt,
    readBy,
  };
}

export async function createMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  const ref = messagesRef(chatId).doc();
  await ref.set({ senderId, text, createdAt: FieldValue.serverTimestamp(), editedAt: null, deletedAt: null, readBy: {} });
  return toMessage(ref.id, (await ref.get()).data() ?? {});
}

export async function getMessage(chatId: string, messageId: string): Promise<Message | null> {
  const snap = await messagesRef(chatId).doc(messageId).get();
  return snap.exists ? toMessage(snap.id, snap.data() ?? {}) : null;
}

export type ModifyResult =
  | { status: "ok"; message: Message }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "deleted" };

/** Only the sender may edit; deleted messages cannot be edited. */
export async function updateText(chatId: string, messageId: string, userId: string, text: string): Promise<ModifyResult> {
  const ref = messagesRef(chatId).doc(messageId);
  const outcome = await firestore.runTransaction(async (tx): Promise<"ok" | "not_found" | "forbidden" | "deleted"> => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!snap.exists || !data) return "not_found";
    if (data.senderId !== userId) return "forbidden";
    if (data.deletedAt) return "deleted";
    tx.update(ref, { text, editedAt: FieldValue.serverTimestamp() });
    return "ok";
  });
  if (outcome !== "ok") return { status: outcome };
  return { status: "ok", message: toMessage(messageId, (await ref.get()).data() ?? {}) };
}

/** Soft delete (keeps ordering, cursors and read receipts intact). Idempotent; the text is wiped. */
export async function softDelete(
  chatId: string,
  messageId: string,
  userId: string,
): Promise<Exclude<ModifyResult, { status: "deleted" }>> {
  const ref = messagesRef(chatId).doc(messageId);
  const outcome = await firestore.runTransaction(async (tx): Promise<"ok" | "not_found" | "forbidden"> => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!snap.exists || !data) return "not_found";
    if (data.senderId !== userId) return "forbidden";
    if (!data.deletedAt) tx.update(ref, { text: "", deletedAt: FieldValue.serverTimestamp() });
    return "ok";
  });
  if (outcome !== "ok") return { status: outcome };
  return { status: "ok", message: toMessage(messageId, (await ref.get()).data() ?? {}) };
}

export type ListResult = { status: "ok"; messages: Message[] } | { status: "cursor_not_found" };

/** Latest `limit` messages (older than `before` if given), returned oldest first. */
export async function listMessages(chatId: string, limit: number, before?: string): Promise<ListResult> {
  let query = messagesRef(chatId).orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(limit);
  if (before) {
    const cursor = await messagesRef(chatId).doc(before).get();
    if (!cursor.exists) return { status: "cursor_not_found" };
    query = query.startAfter(cursor);
  }
  const snap = await query.get();
  return { status: "ok", messages: snap.docs.map((d) => toMessage(d.id, d.data())).reverse() };
}

export type ReadResult = { status: "ok"; message: Message } | { status: "not_found" } | { status: "own_message" };

/** Idempotent: the first read time is kept. */
export async function setRead(chatId: string, messageId: string, userId: string): Promise<ReadResult> {
  const ref = messagesRef(chatId).doc(messageId);
  const outcome = await firestore.runTransaction(async (tx): Promise<"ok" | "not_found" | "own_message"> => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (!snap.exists || !data) return "not_found";
    if (data.senderId === userId) return "own_message";
    if (!(data.readBy as Record<string, unknown> | undefined)?.[userId]) {
      tx.update(ref, new FieldPath("readBy", userId), FieldValue.serverTimestamp());
    }
    return "ok";
  });
  if (outcome !== "ok") return { status: outcome };
  return { status: "ok", message: toMessage(messageId, (await ref.get()).data() ?? {}) };
}

export type LastSeenResult =
  | { status: "ok"; messageId: string; updated: boolean }
  | { status: "not_found" };

/** Last-seen only moves forward in time. */
export async function setLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeenResult> {
  const msgRef = messagesRef(chatId).doc(messageId);
  const seenRef = lastSeenRef(chatId, userId);
  return firestore.runTransaction(async (tx): Promise<LastSeenResult> => {
    const [msg, seen] = await Promise.all([tx.get(msgRef), tx.get(seenRef)]);
    const msgData = msg.data();
    if (!msg.exists || !msgData) return { status: "not_found" };
    const msgCreatedAt = msgData.createdAt as Timestamp | undefined;
    const current = seen.data()?.messageCreatedAt as Timestamp | undefined;
    if (current && msgCreatedAt && current.toMillis() > msgCreatedAt.toMillis()) {
      return { status: "ok", messageId: seen.data()?.messageId as string, updated: false };
    }
    tx.set(seenRef, { messageId, messageCreatedAt: msgCreatedAt ?? null, updatedAt: FieldValue.serverTimestamp() });
    return { status: "ok", messageId, updated: true };
  });
}
