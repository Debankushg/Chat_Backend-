import { z } from "zod";

export const idSchema = z.string().uuid();
export const firestoreIdSchema = z.string().min(1).max(128).regex(/^[^/]+$/, "must not contain '/'");
