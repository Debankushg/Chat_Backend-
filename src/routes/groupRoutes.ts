import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as group from "../controllers/groupController";

const router = Router();

router.post("/create", asyncHandler(group.createGroup));
router.get("/:groupId", asyncHandler(group.getGroup));
router.patch("/:groupId", asyncHandler(group.renameGroup));
router.delete("/:groupId", asyncHandler(group.deleteGroup));
router.post("/:groupId/members", asyncHandler(group.addMember));
router.delete("/:groupId/members/:memberId", asyncHandler(group.removeMember));
router.patch("/:groupId/members/:memberId/role", asyncHandler(group.changeRole));

export default router;
