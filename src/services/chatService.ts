import { HttpError } from "../utils/httpError";
import * as chatModel from "../models/chatModel";
import { ChatSummary } from "../models/types";
import { assertUserExists, assertUsersExist } from "./userService";

/** Returns the existing 1:1 chat for the pair, or creates it. Order of A/B is irrelevant. */
export async function createOrGetChat(userAId: string, userBId: string): Promise<string> {
  if (userAId === userBId) throw new HttpError(400, "A chat requires two different users");
  await assertUsersExist([userAId, userBId]);
  const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  return chatModel.upsertChat(a, b);
}

export async function assertChatMember(chatId: string, userId: string): Promise<void> {
  if (!(await chatModel.chatExists(chatId))) throw new HttpError(404, "Chat not found");
  if (!(await chatModel.isMember(chatId, userId))) throw new HttpError(403, "User is not a member of this chat");
}

export async function listUserChats(userId: string): Promise<ChatSummary[]> {
  await assertUserExists(userId);
  return chatModel.findChatsByUser(userId);
}
