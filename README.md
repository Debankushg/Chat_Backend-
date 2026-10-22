# Chat System API

Node.js + TypeScript (strict) · PostgreSQL (users, chats, members) · Firebase Firestore (messages, read receipts, last seen).

## Setup
1. `cp .env.example .env` and set `DATABASE_URL` plus Firebase credentials (service account JSON path, or `FIRESTORE_EMULATOR_HOST`).
2. `createdb chat_system && npm run migrate`
3. `npm run dev` then open http://localhost:3000/docs (Swagger UI; raw spec at /docs.json)

## Endpoints
| Method | Path | Body / Query | Result |
|---|---|---|---|
| POST | /users *(helper)* | `{name}` | user |
| POST | /chat/create | `{userAId, userBId}` | `{chatId}` (idempotent per pair) |
| POST | /chat/:chatId/message/send | `{senderId, text}` | message |
| GET | /chat/:chatId/messages?userId=&limit=50&before= | | `{messages}` oldest→newest (latest N) |
| PATCH | /chat/:chatId/message/:messageId | `{userId, text}` | edited message (sender only) |
| DELETE | /chat/:chatId/message/:messageId?userId= | | soft-deleted message (sender only) |
| POST | /chat/:chatId/message/:messageId/read | `{userId}` | message with `readBy` |
| POST | /chat/:chatId/lastseen | `{userId, messageId}` | `{userId, messageId, updated}` |
| GET | /user/:userId/chats | | `{chats:[{id, memberIds, createdAt}]}` |

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
                          │ chats (user_a < user_b)  │   │   messages/{messageId}  │
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
4. There is no cross-database transaction. Firestore is written after the PostgreSQL check, and chats are never deleted, so the two cannot drift apart.

Example, **send message**: `POST /chat/:chatId/message/send` → route → `messageController.sendMessage` (validates body) → `messageService.sendMessage` → PostgreSQL membership check → `messageModel.createMessage` → Firestore `chats/{chatId}/messages/{newId}`.

### Folder structure (`src/`)
| Folder / file | Role | Talks to |
|---|---|---|
| `server.ts`, `app.ts` | Start the server; register JSON parsing, Swagger, routes, error handler | routes, middleware, docs |
| `routes/` | Map URL + method to a controller (`chatRoutes`, `userRoutes`) | controllers |
| `controllers/` | Read and validate the request, return the HTTP response. No business logic | validators, services |
| `validators/` | zod schemas for params, query and body | used by controllers |
| `services/` | Business rules and the mapping from outcomes to HTTP errors | models, other services |
| `models/` | Only place that runs SQL or Firestore calls; `types.ts` holds shared types | config/database, config/firebase |
| `config/` | `index.ts` env vars, `database.ts` PostgreSQL pool, `firebase.ts` Firestore client | `.env`, `serviceAccount.json` |
| `middleware/` | `errorHandler.ts`: 404 handler and error to JSON | app.ts |
| `utils/` | `HttpError`, `asyncHandler`, timestamp helper | everywhere |
| `docs/` | `openapi.ts`, the Swagger spec served at `/docs` | app.ts |
| `scripts/` | `migrate.ts` runs `migrations/*.sql` against PostgreSQL | config/database |

Top level: `migrations/` (SQL schema), `.env` (settings), `serviceAccount.json` (Firebase key, git-ignored).

Dependencies only point downward: routes → controllers → services → models → config. A lower layer never imports from a higher one.

## Design notes
- 1:1 uniqueness: pair stored as `user_a_id < user_b_id` with a UNIQUE constraint; `INSERT … ON CONFLICT DO NOTHING` makes concurrent creates safe.
- Firestore: `chats/{chatId}/messages/{id}` (`readBy` map of userId→timestamp) and `chats/{chatId}/lastSeen/{userId}`. Timestamps are server-generated.
- Membership is checked against Postgres on every chat operation (403 for non-members).
- Read is idempotent (first read time kept); you can't mark your own message read. Last-seen only moves forward.
- No authentication: user IDs come from the request. Add auth middleware (e.g. Firebase ID tokens) and derive the user from the token before production.
