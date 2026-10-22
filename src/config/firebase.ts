import fs from "fs";
import path from "path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./index";

function init() {
  // Emulator: FIRESTORE_EMULATOR_HOST is picked up by the SDK automatically.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: config.firebaseProjectId ?? "demo-chat" });
  }
  if (config.firebaseServiceAccountPath) {
    const keyPath = path.resolve(config.firebaseServiceAccountPath);
    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `Firebase service account file not found at ${keyPath}. Download it from Firebase Console > Project settings > ` +
          `Service accounts > Generate new private key, or set FIRESTORE_EMULATOR_HOST to use the local emulator.`,
      );
    }
    const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    return initializeApp({ credential: cert(key) });
  }
  return initializeApp({ credential: applicationDefault() });
}

init();
export const firestore = getFirestore();
