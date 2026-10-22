import { Request, Response } from "express";
import * as userService from "../services/userService";
import * as chatService from "../services/chatService";
import { createUserBody, userIdParams } from "../validators/userValidator";

export async function createUser(req: Request, res: Response): Promise<void> {
  const { name } = createUserBody.parse(req.body);
  res.status(201).json(await userService.createUser(name));
}

export async function listUserChats(req: Request, res: Response): Promise<void> {
  const { userId } = userIdParams.parse(req.params);
  res.json({ chats: await chatService.listUserChats(userId) });
}
