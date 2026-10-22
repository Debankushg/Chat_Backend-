import { HttpError } from "../utils/httpError";
import * as groupModel from "../models/groupModel";
import * as messageModel from "../models/messageModel";
import { GroupDetail, GroupRole } from "../models/types";
import { assertUserExists, assertUsersExist } from "./userService";

const MAX_MEMBERS = 256;

async function loadGroup(groupId: string): Promise<groupModel.GroupRow> {
  const chat = await groupModel.findChat(groupId);
  if (!chat) throw new HttpError(404, "Group not found");
  if (chat.type !== "group") throw new HttpError(400, "This chat is not a group");
  return chat;
}

async function requireMember(groupId: string, userId: string): Promise<GroupRole> {
  const role = await groupModel.getRole(groupId, userId);
  if (!role) throw new HttpError(403, "You are not a member of this group");
  return role;
}

async function requireAdmin(groupId: string, userId: string, action: string): Promise<void> {
  const role = await requireMember(groupId, userId);
  if (role !== "admin") throw new HttpError(403, `Only group admins can ${action}`);
}

async function detail(groupId: string): Promise<GroupDetail> {
  const group = await loadGroup(groupId);
  return {
    id: group.id,
    name: group.name as string,
    createdBy: group.createdBy,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    members: await groupModel.listMembers(groupId),
  };
}

export async function createGroup(creatorId: string, name: string, memberIds: string[]): Promise<GroupDetail> {
  const others = [...new Set(memberIds)].filter((id) => id !== creatorId);
  if (others.length === 0) throw new HttpError(400, "A group needs at least one member besides the creator");
  if (others.length + 1 > MAX_MEMBERS) throw new HttpError(400, `A group can have at most ${MAX_MEMBERS} members`);
  await assertUsersExist([creatorId, ...others]);
  return detail(await groupModel.insertGroup(creatorId, name, others));
}

export async function getGroup(groupId: string, userId: string): Promise<GroupDetail> {
  await loadGroup(groupId);
  await requireMember(groupId, userId);
  return detail(groupId);
}

export async function renameGroup(groupId: string, userId: string, name: string): Promise<GroupDetail> {
  await loadGroup(groupId);
  await requireAdmin(groupId, userId, "rename the group");
  await groupModel.renameGroup(groupId, name);
  return detail(groupId);
}

export async function deleteGroup(groupId: string, userId: string): Promise<void> {
  await loadGroup(groupId);
  await requireAdmin(groupId, userId, "delete the group");
  // Firestore first: if it fails the group still exists and the call can be retried.
  await messageModel.deleteChatData(groupId);
  await groupModel.deleteGroup(groupId);
}

export async function addMember(groupId: string, userId: string, memberId: string): Promise<GroupDetail> {
  await loadGroup(groupId);
  await requireAdmin(groupId, userId, "add members");
  await assertUserExists(memberId);
  if (await groupModel.getRole(groupId, memberId)) throw new HttpError(409, "User is already a member of this group");
  if ((await groupModel.listMembers(groupId)).length >= MAX_MEMBERS) {
    throw new HttpError(400, `A group can have at most ${MAX_MEMBERS} members`);
  }
  await groupModel.insertMember(groupId, memberId);
  return detail(groupId);
}

async function assertNotLastAdmin(groupId: string, targetRole: GroupRole, message: string): Promise<void> {
  if (targetRole === "admin" && (await groupModel.countAdmins(groupId)) <= 1) throw new HttpError(400, message);
}

/** An admin can remove anyone; a member can only remove themself (leave). */
export async function removeMember(groupId: string, userId: string, memberId: string): Promise<void> {
  await loadGroup(groupId);
  const role = await requireMember(groupId, userId);
  if (userId !== memberId && role !== "admin") throw new HttpError(403, "Only group admins can remove other members");
  const targetRole = userId === memberId ? role : await groupModel.getRole(groupId, memberId);
  if (!targetRole) throw new HttpError(404, "Member not found in this group");
  await assertNotLastAdmin(
    groupId,
    targetRole,
    "The last admin cannot leave or be removed. Promote another member first, or delete the group.",
  );
  await groupModel.deleteMember(groupId, memberId);
}

export async function changeRole(groupId: string, userId: string, memberId: string, role: GroupRole): Promise<GroupDetail> {
  await loadGroup(groupId);
  await requireAdmin(groupId, userId, "change member roles");
  const current = await groupModel.getRole(groupId, memberId);
  if (!current) throw new HttpError(404, "Member not found in this group");
  if (role === "member") {
    await assertNotLastAdmin(groupId, current, "The last admin cannot be demoted. Promote another member first.");
  }
  await groupModel.updateRole(groupId, memberId, role);
  return detail(groupId);
}
