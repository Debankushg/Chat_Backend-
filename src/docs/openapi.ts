const uuid = { type: "string", format: "uuid" } as const;
const uuidParam = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: uuid,
});
const messageIdParam = {
  name: "messageId",
  in: "path",
  required: true,
  description: "Firestore message document ID",
  schema: { type: "string" },
};
const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});
const json = (schema: object) => ({ "application/json": { schema } });

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Chat System API",
    version: "1.0.0",
    description:
      "1:1 chat backend. Users and chats live in PostgreSQL; messages, read receipts and last-seen live in Firestore.",
  },
  tags: [
    { name: "Users" },
    { name: "Chats" },
    { name: "Messages" },
  ],
  paths: {
    "/users": {
      post: {
        tags: ["Users"],
        summary: "Create a user (helper)",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["name"],
            properties: { name: { type: "string", minLength: 1, maxLength: 100, example: "Alice" } },
          }),
        },
        responses: {
          "201": { description: "Created", content: json({ $ref: "#/components/schemas/User" }) },
          "400": errorResponse("Validation failed"),
        },
      },
    },
    "/user/{userId}/chats": {
      get: {
        tags: ["Users"],
        summary: "List a user's chats with member IDs",
        parameters: [uuidParam("userId", "User ID")],
        responses: {
          "200": {
            description: "OK",
            content: json({
              type: "object",
              properties: { chats: { type: "array", items: { $ref: "#/components/schemas/Chat" } } },
            }),
          },
          "404": errorResponse("User not found"),
        },
      },
    },
    "/chat/create": {
      post: {
        tags: ["Chats"],
        summary: "Create or get the 1:1 chat for two users",
        description: "Idempotent: the same pair (in either order) always returns the same chatId.",
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["userAId", "userBId"],
            properties: { userAId: uuid, userBId: uuid },
          }),
        },
        responses: {
          "200": {
            description: "OK",
            content: json({ type: "object", properties: { chatId: uuid } }),
          },
          "400": errorResponse("Validation failed or both IDs are the same"),
          "404": errorResponse("User not found"),
        },
      },
    },
    "/chat/{chatId}/message/send": {
      post: {
        tags: ["Messages"],
        summary: "Send a message",
        parameters: [uuidParam("chatId", "Chat ID")],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["senderId", "text"],
            properties: { senderId: uuid, text: { type: "string", minLength: 1, maxLength: 5000, example: "Hello!" } },
          }),
        },
        responses: {
          "201": { description: "Created", content: json({ $ref: "#/components/schemas/Message" }) },
          "400": errorResponse("Validation failed"),
          "403": errorResponse("Sender is not a member of the chat"),
          "404": errorResponse("Chat not found"),
        },
      },
    },
    "/chat/{chatId}/messages": {
      get: {
        tags: ["Messages"],
        summary: "Get messages ordered by timestamp",
        description: "Returns the latest `limit` messages, oldest first. Use `before` to page backwards.",
        parameters: [
          uuidParam("chatId", "Chat ID"),
          { name: "userId", in: "query", required: true, description: "Requesting user (membership check)", schema: uuid },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          { name: "before", in: "query", description: "Message ID; return messages older than it", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: json({
              type: "object",
              properties: { messages: { type: "array", items: { $ref: "#/components/schemas/Message" } } },
            }),
          },
          "400": errorResponse("Validation failed"),
          "403": errorResponse("User is not a member of the chat"),
          "404": errorResponse("Chat or cursor message not found"),
        },
      },
    },
    "/chat/{chatId}/message/{messageId}": {
      patch: {
        tags: ["Messages"],
        summary: "Edit your own message",
        description: "Only the sender can edit. Sets `editedAt`. Deleted messages return 409.",
        parameters: [uuidParam("chatId", "Chat ID"), messageIdParam],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["userId", "text"],
            properties: { userId: uuid, text: { type: "string", minLength: 1, maxLength: 5000, example: "Hello (edited)" } },
          }),
        },
        responses: {
          "200": { description: "OK", content: json({ $ref: "#/components/schemas/Message" }) },
          "400": errorResponse("Validation failed"),
          "403": errorResponse("Not a chat member, or not the message sender"),
          "404": errorResponse("Chat or message not found"),
          "409": errorResponse("Message already deleted"),
        },
      },
      delete: {
        tags: ["Messages"],
        summary: "Delete your own message",
        description:
          "Soft delete: the text is wiped and `deletedAt` is set, so ordering and read receipts are preserved. Idempotent.",
        parameters: [
          uuidParam("chatId", "Chat ID"),
          messageIdParam,
          { name: "userId", in: "query", required: true, description: "The requesting user (must be the sender)", schema: uuid },
        ],
        responses: {
          "200": { description: "OK", content: json({ $ref: "#/components/schemas/Message" }) },
          "400": errorResponse("Validation failed"),
          "403": errorResponse("Not a chat member, or not the message sender"),
          "404": errorResponse("Chat or message not found"),
        },
      },
    },
    "/chat/{chatId}/message/{messageId}/read": {
      post: {
        tags: ["Messages"],
        summary: "Mark a message as read",
        description: "Idempotent (first read time is kept). A user cannot mark their own message read.",
        parameters: [uuidParam("chatId", "Chat ID"), messageIdParam],
        requestBody: {
          required: true,
          content: json({ type: "object", required: ["userId"], properties: { userId: uuid } }),
        },
        responses: {
          "200": { description: "OK", content: json({ $ref: "#/components/schemas/Message" }) },
          "400": errorResponse("Validation failed or own message"),
          "403": errorResponse("User is not a member of the chat"),
          "404": errorResponse("Chat or message not found"),
        },
      },
    },
    "/chat/{chatId}/lastseen": {
      post: {
        tags: ["Messages"],
        summary: "Update the last seen message for a user",
        description: "Only moves forward; an older message returns `updated: false`.",
        parameters: [uuidParam("chatId", "Chat ID")],
        requestBody: {
          required: true,
          content: json({
            type: "object",
            required: ["userId", "messageId"],
            properties: { userId: uuid, messageId: { type: "string" } },
          }),
        },
        responses: {
          "200": {
            description: "OK",
            content: json({
              type: "object",
              properties: { userId: uuid, messageId: { type: "string" }, updated: { type: "boolean" } },
            }),
          },
          "400": errorResponse("Validation failed"),
          "403": errorResponse("User is not a member of the chat"),
          "404": errorResponse("Chat or message not found"),
        },
      },
    },
  },
  components: {
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" } } },
      User: {
        type: "object",
        properties: { id: uuid, name: { type: "string" }, createdAt: { type: "string", format: "date-time" } },
      },
      Chat: {
        type: "object",
        properties: {
          id: uuid,
          memberIds: { type: "array", items: uuid },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string" },
          senderId: uuid,
          text: { type: "string", nullable: true, description: "null once the message is deleted" },
          createdAt: { type: "string", format: "date-time", nullable: true },
          editedAt: { type: "string", format: "date-time", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          readBy: {
            type: "object",
            description: "Map of userId to read timestamp",
            additionalProperties: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
};
