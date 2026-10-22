import { Timestamp } from "firebase-admin/firestore";

export const toIso = (t: unknown): string | null => (t instanceof Timestamp ? t.toDate().toISOString() : null);
