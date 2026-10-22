import { z } from "zod";
import { idSchema } from "./common";

export const createUserBody = z.object({ name: z.string().trim().min(1).max(100) });
export const userIdParams = z.object({ userId: idSchema });
