import { z } from "zod";
import { firestoreIdSchema, idSchema } from "./common";

export const createChatBody = z.object({ userAId: idSchema, userBId: idSchema });

export const chatParams = z.object({ chatId: idSchema });
export const messageParams = z.object({ chatId: idSchema, messageId: firestoreIdSchema });

export const sendMessageBody = z.object({ senderId: idSchema, text: z.string().trim().min(1).max(5000) });
export const getMessagesQuery = z.object({
  userId: idSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: firestoreIdSchema.optional(),
});
export const editMessageBody = z.object({ userId: idSchema, text: z.string().trim().min(1).max(5000) });
export const deleteMessageQuery = z.object({ userId: idSchema });
export const readBody = z.object({ userId: idSchema });
export const lastSeenBody = z.object({ userId: idSchema, messageId: firestoreIdSchema });
