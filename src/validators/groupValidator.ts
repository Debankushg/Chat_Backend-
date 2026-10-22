import { z } from "zod";
import { idSchema } from "./common";

const groupName = z.string().trim().min(1).max(100);

export const createGroupBody = z.object({
  creatorId: idSchema,
  name: groupName,
  memberIds: z.array(idSchema).min(1).max(255),
});
export const groupParams = z.object({ groupId: idSchema });
export const memberParams = z.object({ groupId: idSchema, memberId: idSchema });
export const userQuery = z.object({ userId: idSchema });
export const renameGroupBody = z.object({ userId: idSchema, name: groupName });
export const addMemberBody = z.object({ userId: idSchema, memberId: idSchema });
export const roleBody = z.object({ userId: idSchema, role: z.enum(["admin", "member"]) });
