import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as chat from "../controllers/chatController";
import * as message from "../controllers/messageController";

const router = Router();

router.post("/create", asyncHandler(chat.createChat));
router.post("/:chatId/message/send", asyncHandler(message.sendMessage));
router.get("/:chatId/messages", asyncHandler(message.getMessages));
router.patch("/:chatId/message/:messageId", asyncHandler(message.editMessage));
router.delete("/:chatId/message/:messageId", asyncHandler(message.deleteMessage));
router.post("/:chatId/message/:messageId/read", asyncHandler(message.markRead));
router.post("/:chatId/lastseen", asyncHandler(message.updateLastSeen));

export default router;
