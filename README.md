# Chat System API

Node.js + TypeScript (strict) · PostgreSQL (users, chats, members) · Firebase Firestore (messages, read receipts, last seen).

## Setup
1. `cp .env.example .env` and set `DATABASE_URL` plus Firebase credentials (service account JSON path, or `FIRESTORE_EMULATOR_HOST`).
2. `createdb chat_system && npm run migrate`
3. `npm run dev` then open http://localhost:3000/docs (Swagger UI; raw spec at /docs.json)

## API Reference

**Base URL:** `http://localhost:3000` · **Interactive docs:** `/docs` (Swagger UI) · **Format:** JSON requests and responses.
All IDs (`userId`, `chatId`, `groupId`, ...) are UUIDs, except `messageId`, which is a Firestore document ID.
Where an input goes: **Path** = inside the URL (`/chat/:chatId/...`), **Query** = after `?`, **Body** = JSON body.

### 1. Users
| Method | Endpoint | What it does | Input | Success response | Error codes |
|---|---|---|---|---|---|
| POST | `/users` | Create a user (helper, so you have users to chat with) | **Body:** `name` | `201` user `{id, name, createdAt}` | 400 invalid name |
| GET | `/user/:userId/chats` | List all of a user's chats (1:1 and groups) with member IDs | **Path:** `userId` | `200` `{chats: [{id, type, name, memberIds, createdAt}]}`; `type` is `direct` or `group`, `name` is null for 1:1 | 400 invalid ID · 404 user not found |

### 2. One-to-one chats
| Method | Endpoint | What it does | Input | Success response | Error codes |
|---|---|---|---|---|---|
| POST | `/chat/create` | Create the chat between two users, or return the existing one (same result whichever order you send them) | **Body:** `userAId`, `userBId` | `200` `{chatId}` | 400 same user twice / invalid ID · 404 user not found |

### 3. Messages (work for 1:1 chats **and** groups)
| Method | Endpoint | What it does | Input | Success response | Error codes |
|---|---|---|---|---|---|
| POST | `/chat/:chatId/message/send` | Send a message (saved in Firestore with a server timestamp) | **Path:** `chatId` · **Body:** `senderId`, `text` (1-5000 chars) | `201` message | 400 invalid input · 403 not a member · 404 chat not found |
| GET | `/chat/:chatId/messages` | Get messages ordered by time, oldest first. Returns the latest `limit` messages | **Path:** `chatId` · **Query:** `userId`, `limit` (1-200, default 50), `before` (message ID, optional, for older pages) | `200` `{messages: [...]}` | 400 invalid input · 403 not a member · 404 chat or `before` message not found |
| PATCH | `/chat/:chatId/message/:messageId` | Edit your own message (sets `editedAt`) | **Path:** `chatId`, `messageId` · **Body:** `userId`, `text` | `200` updated message | 400 invalid input · 403 not a member / not the sender · 404 not found · 409 already deleted |
| DELETE | `/chat/:chatId/message/:messageId` | Delete your own message (soft delete: text removed, `deletedAt` set, order and read receipts kept) | **Path:** `chatId`, `messageId` · **Query:** `userId` | `200` message with `text: null` | 400 invalid input · 403 not a member / not the sender · 404 not found |
| POST | `/chat/:chatId/message/:messageId/read` | Mark a message as read by a user (first read time is kept) | **Path:** `chatId`, `messageId` · **Body:** `userId` | `200` message with `readBy: {userId: time}` | 400 own message / invalid input · 403 not a member · 404 not found |
| POST | `/chat/:chatId/lastseen` | Save the last message a user has seen in the chat (only moves forward) | **Path:** `chatId` · **Body:** `userId`, `messageId` | `200` `{userId, messageId, updated}` | 400 invalid input · 403 not a member · 404 not found |

**Message object:** `{id, senderId, text, createdAt, editedAt, deletedAt, readBy}`. `text` is `null` after deletion.

### 4. Group chats
Only **admins** can rename, delete, add members and change roles. The creator is the first admin. To send messages in a group, use the Messages endpoints above with the `groupId` as the `chatId`.

| Method | Endpoint | What it does | Input | Who can call | Success response | Error codes |
|---|---|---|---|---|---|---|
| POST | `/group/create` | Create a group | **Body:** `creatorId`, `name` (1-100 chars), `memberIds` (1-255 IDs) | Any user | `201` group with members | 400 invalid input · 404 user not found |
| GET | `/group/:groupId` | Get group details and members with roles | **Path:** `groupId` · **Query:** `userId` | Members | `200` group | 400 not a group · 403 not a member · 404 group not found |
| PATCH | `/group/:groupId` | Rename the group | **Path:** `groupId` · **Body:** `userId`, `name` | Admins | `200` group | 400 invalid name · 403 not an admin · 404 not found |
| DELETE | `/group/:groupId` | Delete the group, its members and all its messages | **Path:** `groupId` · **Query:** `userId` | Admins | `200` `{groupId, deleted: true}` | 403 not an admin · 404 not found |
| POST | `/group/:groupId/members` | Add a member | **Path:** `groupId` · **Body:** `userId` (the admin), `memberId` | Admins | `201` group | 400 group full · 403 not an admin · 404 user/group not found · 409 already a member |
| DELETE | `/group/:groupId/members/:memberId` | Remove a member, or leave the group (`memberId` = `userId`) | **Path:** `groupId`, `memberId` · **Query:** `userId` | Admins remove anyone; members only themselves | `200` `{groupId, memberId, removed: true}` | 400 last admin can't leave · 403 not allowed · 404 not found |
| PATCH | `/group/:groupId/members/:memberId/role` | Promote to `admin` or demote to `member` | **Path:** `groupId`, `memberId` · **Body:** `userId` (the admin), `role` | Admins | `200` group | 400 last admin can't be demoted · 403 not an admin · 404 not found |

### Error format
Every error returns JSON `{ "error": "message" }`. Validation errors (400) also include `details: [{path, message}]`.

| Code | Meaning |
|---|---|
| 400 | Invalid input, or the action isn't allowed (e.g. marking your own message read) |
| 403 | The user isn't a member of the chat/group, or isn't allowed (not the sender, not an admin) |
| 404 | User, chat, group, message or route not found |
| 409 | Conflict: user already in the group, or editing a deleted message |
| 500 | Unexpected server error (check the server logs) |

## Architecture

```
                         ┌──────────────────────────┐
                         │  Client (Swagger / app)  │
                         └─────────────┬────────────┘
                                       │ HTTP / JSON
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             Node.js + Express API                           │
│                                                                             │
│  routes/        URL + HTTP method  ──►  picks a controller                  │
│     │                                                                       │
│  controllers/   parse request using validators/ (zod), send the response    │
│     │                                                                       │
│  services/      business rules: membership, "own message only",             │
│     │           1:1 pair ordering, error codes (403 / 404 / 409)            │
│     │                                                                       │
│  models/        data access only: SQL queries and Firestore calls           │
│     │                                                                       │
│     ├─ userModel, chatModel ───────────┐   messageModel ─────────┐          │
│  config/ database.ts (pg Pool)         │   config/ firebase.ts   │          │
│                                        │   (firebase-admin)      │          │
│  Cross-cutting: middleware/errorHandler (404 + error → JSON),               │
│                 utils/ (HttpError, asyncHandler, time helpers)              │
└────────────────────────────────────────┼─────────────────────────┼──────────┘
                                         │ SQL                     │ gRPC (service account key)
                          ┌──────────────▼───────────┐   ┌─────────▼───────────────┐
                          │   PostgreSQL             │   │   Firebase Firestore    │
                          │   WHO and WHICH chats    │   │   WHAT was said         │
                          │                          │   │                         │
                          │ users                    │   │ chats/{chatId}/         │
                          │ chats (direct + group)   │   │   messages/{messageId}  │
                          │ chat_members             │   │     senderId, text,     │
                          │                          │   │     createdAt, editedAt,│
                          │                          │   │     deletedAt, readBy{} │
                          │                          │   │   lastSeen/{userId}     │
                          └──────────────────────────┘   └─────────────────────────┘
```

### How PostgreSQL and Firestore work together
The two stores are linked only by **`chatId`** (a UUID created in PostgreSQL, used as the Firestore document ID) and **`userId`**.

1. PostgreSQL is the source of truth for users, chats and membership.
2. Firestore stores everything that is written often: messages, read receipts and last seen.
3. Every message call first asks PostgreSQL "is this user a member of this chat?" (services/chatService `assertChatMember`). Only then does it touch Firestore.
4. There is no cross-database transaction. Firestore is written after the PostgreSQL check, and a group delete removes the Firestore data first, so a failure leaves the group intact and can be retried.

Example, **send message**: `POST /chat/:chatId/message/send` → route → `messageController.sendMessage` (validates body) → `messageService.sendMessage` → PostgreSQL membership check → `messageModel.createMessage` → Firestore `chats/{chatId}/messages/{newId}`.

### Folder structure (`src/`)
| Folder / file | Role | Talks to |
|---|---|---|
| `server.ts`, `app.ts` | Start the server; register JSON parsing, Swagger, routes, error handler | routes, middleware, docs |
| `routes/` | Map URL + method to a controller (`chatRoutes`, `userRoutes`, `groupRoutes`) | controllers |
| `controllers/` | Read and validate the request, return the HTTP response. No business logic | validators, services |
| `validators/` | zod schemas for params, query and body | used by controllers |
| `services/` | Business rules and the mapping from outcomes to HTTP errors | models, other services |
| `models/` | Only place that runs SQL or Firestore calls (`userModel`, `chatModel`, `groupModel`, `messageModel`); `types.ts` holds shared types | config/database, config/firebase |
| `config/` | `index.ts` env vars, `database.ts` PostgreSQL pool, `firebase.ts` Firestore client | `.env`, `serviceAccount.json` |
| `middleware/` | `errorHandler.ts`: 404 handler and error to JSON | app.ts |
| `utils/` | `HttpError`, `asyncHandler`, timestamp helper | everywhere |
| `swagger/` | `openapi.ts`, the Swagger spec served at `/docs` | app.ts |
| `scripts/` | `migrate.ts` runs `migrations/*.sql` against PostgreSQL | config/database |

Top level: `migrations/` (SQL schema), `.env` (settings), `serviceAccount.json` (Firebase key, git-ignored).

Dependencies only point downward: routes → controllers → services → models → config. A lower layer never imports from a higher one.

## Group chats
Groups live in the same `chats` / `chat_members` tables (`chats.type = 'group'`, `chat_members.role = admin|member`). A group id is a chat id, so **all `/chat/:chatId/...` message endpoints (send, list, edit, delete, read, lastseen) work for groups unchanged**, and Firestore stores group messages at `chats/{groupId}/messages` like any other chat. Rules: only admins rename, delete, add members or change roles; members can leave; the last admin cannot leave or be demoted.

## Design notes
- 1:1 uniqueness: pair stored as `user_a_id < user_b_id` with a UNIQUE constraint; `INSERT … ON CONFLICT DO NOTHING` makes concurrent creates safe.
- Firestore: `chats/{chatId}/messages/{id}` (`readBy` map of userId→timestamp) and `chats/{chatId}/lastSeen/{userId}`. Timestamps are server-generated.
- Membership is checked against Postgres on every chat operation (403 for non-members).
- Read is idempotent (first read time kept); you can't mark your own message read. Last-seen only moves forward.
- No authentication: user IDs come from the request. Add auth middleware (e.g. Firebase ID tokens) and derive the user from the token before production.
