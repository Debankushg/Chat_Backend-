import { HttpError } from "../utils/httpError";
import * as userModel from "../models/userModel";
import { User } from "../models/types";

export const createUser = (name: string): Promise<User> => userModel.insertUser(name);

export async function assertUsersExist(ids: string[]): Promise<void> {
  const found = new Set(await userModel.findExistingIds(ids));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) throw new HttpError(404, `User not found: ${missing.join(", ")}`);
}

export async function assertUserExists(id: string): Promise<void> {
  if (!(await userModel.userExists(id))) throw new HttpError(404, "User not found");
}
