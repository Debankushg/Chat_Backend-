import { Request, Response } from "express";
import * as groupService from "../services/groupService";
import {
  addMemberBody,
  createGroupBody,
  groupParams,
  memberParams,
  renameGroupBody,
  roleBody,
  userQuery,
} from "../validators/groupValidator";

export async function createGroup(req: Request, res: Response): Promise<void> {
  const { creatorId, name, memberIds } = createGroupBody.parse(req.body);
  res.status(201).json(await groupService.createGroup(creatorId, name, memberIds));
}

export async function getGroup(req: Request, res: Response): Promise<void> {
  const { groupId } = groupParams.parse(req.params);
  const { userId } = userQuery.parse(req.query);
  res.json(await groupService.getGroup(groupId, userId));
}

export async function renameGroup(req: Request, res: Response): Promise<void> {
  const { groupId } = groupParams.parse(req.params);
  const { userId, name } = renameGroupBody.parse(req.body);
  res.json(await groupService.renameGroup(groupId, userId, name));
}

export async function deleteGroup(req: Request, res: Response): Promise<void> {
  const { groupId } = groupParams.parse(req.params);
  const { userId } = userQuery.parse(req.query);
  await groupService.deleteGroup(groupId, userId);
  res.json({ groupId, deleted: true });
}

export async function addMember(req: Request, res: Response): Promise<void> {
  const { groupId } = groupParams.parse(req.params);
  const { userId, memberId } = addMemberBody.parse(req.body);
  res.status(201).json(await groupService.addMember(groupId, userId, memberId));
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  const { groupId, memberId } = memberParams.parse(req.params);
  const { userId } = userQuery.parse(req.query);
  await groupService.removeMember(groupId, userId, memberId);
  res.json({ groupId, memberId, removed: true });
}

export async function changeRole(req: Request, res: Response): Promise<void> {
  const { groupId, memberId } = memberParams.parse(req.params);
  const { userId, role } = roleBody.parse(req.body);
  res.json(await groupService.changeRole(groupId, userId, memberId, role));
}
