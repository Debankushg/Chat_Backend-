import { HttpError } from "../utils/httpError";
import * as messageModel from "../models/messageModel";
import { Message } from "../models/types";
import { assertChatMember } from "./chatService";

export async function sendMessage(chatId: string, senderId: string, text: string): Promise<Message> {
  await assertChatMember(chatId, senderId);
  return messageModel.createMessage(chatId, senderId, text);
}

export async function editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message> {
  await assertChatMember(chatId, userId);
  const result = await messageModel.updateText(chatId, messageId, userId, text);
  if (result.status === "not_found") throw new HttpError(404, "Message not found");
  if (result.status === "forbidden") throw new HttpError(403, "You can only edit your own messages");
  if (result.status === "deleted") throw new HttpError(409, "Message has been deleted");
  return result.message;
}

export async function deleteMessage(chatId: string, messageId: string, userId: string): Promise<Message> {
  await assertChatMember(chatId, userId);
  const result = await messageModel.softDelete(chatId, messageId, userId);
  if (result.status === "not_found") throw new HttpError(404, "Message not found");
  if (result.status === "forbidden") throw new HttpError(403, "You can only delete your own messages");
  return result.message;
}

export async function getMessages(chatId: string, userId: string, limit: number, before?: string): Promise<Message[]> {
  await assertChatMember(chatId, userId);
  const result = await messageModel.listMessages(chatId, limit, before);
  if (result.status === "cursor_not_found") throw new HttpError(404, "Cursor message not found");
  return result.messages;
}

export async function markMessageRead(chatId: string, messageId: string, userId: string): Promise<Message> {
  await assertChatMember(chatId, userId);
  const result = await messageModel.setRead(chatId, messageId, userId);
  if (result.status === "not_found") throw new HttpError(404, "Message not found");
  if (result.status === "own_message") throw new HttpError(400, "Cannot mark your own message as read");
  return result.message;
}

export async function updateLastSeen(chatId: string, userId: string, messageId: string) {
  await assertChatMember(chatId, userId);
  const result = await messageModel.setLastSeen(chatId, userId, messageId);
  if (result.status === "not_found") throw new HttpError(404, "Message not found");
  return { userId, messageId: result.messageId, updated: result.updated };
}
