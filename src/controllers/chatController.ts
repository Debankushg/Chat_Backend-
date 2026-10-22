import { Request, Response } from "express";
import * as chatService from "../services/chatService";
import { createChatBody } from "../validators/chatValidator";

export async function createChat(req: Request, res: Response): Promise<void> {
  const { userAId, userBId } = createChatBody.parse(req.body);
  res.json({ chatId: await chatService.createOrGetChat(userAId, userBId) });
}
