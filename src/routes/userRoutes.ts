import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as user from "../controllers/userController";

const router = Router();

router.post("/", asyncHandler(user.createUser)); // helper, not in the original spec
router.get("/:userId/chats", asyncHandler(user.listUserChats));

export default router;
