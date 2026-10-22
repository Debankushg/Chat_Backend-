import { Router } from "express";
import chatRoutes from "./chatRoutes";
import userRoutes from "./userRoutes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
router.use("/chat", chatRoutes);
router.use("/user", userRoutes);
router.use("/users", userRoutes);

export default router;
