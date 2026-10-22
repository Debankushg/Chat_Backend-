export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
  type: "direct" | "group";
  name: string | null;
  memberIds: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string | null; // null once deleted
  createdAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  readBy: Record<string, string>;
}

export type GroupRole = "admin" | "member";

export interface GroupMember {
  userId: string;
  name: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  members: GroupMember[];
}
