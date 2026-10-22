import { Request, Response } from "express";
import * as messageService from "../services/messageService";
import {
  chatParams,
  deleteMessageQuery,
  editMessageBody,
  getMessagesQuery,
  lastSeenBody,
  messageParams,
  readBody,
  sendMessageBody,
} from "../validators/chatValidator";

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { chatId } = chatParams.parse(req.params);
  const { senderId, text } = sendMessageBody.parse(req.body);
  res.status(201).json(await messageService.sendMessage(chatId, senderId, text));
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  const { chatId } = chatParams.parse(req.params);
  const { userId, limit, before } = getMessagesQuery.parse(req.query);
  res.json({ messages: await messageService.getMessages(chatId, userId, limit, before) });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const { chatId, messageId } = messageParams.parse(req.params);
  const { userId } = readBody.parse(req.body);
  res.json(await messageService.markMessageRead(chatId, messageId, userId));
}

export async function updateLastSeen(req: Request, res: Response): Promise<void> {
  const { chatId } = chatParams.parse(req.params);
  const { userId, messageId } = lastSeenBody.parse(req.body);
  res.json(await messageService.updateLastSeen(chatId, userId, messageId));
}

export async function editMessage(req: Request, res: Response): Promise<void> {
  const { chatId, messageId } = messageParams.parse(req.params);
  const { userId, text } = editMessageBody.parse(req.body);
  res.json(await messageService.editMessage(chatId, messageId, userId, text));
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const { chatId, messageId } = messageParams.parse(req.params);
  const { userId } = deleteMessageQuery.parse(req.query);
  res.json(await messageService.deleteMessage(chatId, messageId, userId));
}
