export interface User {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChatSummary {
  id: string;
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
