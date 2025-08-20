import { Router } from "express";
import { pool } from "../db.js";


const router = Router();
router.get("/health", async (_req, res) => {
try {
await pool.query("select 1");
res.json({ ok: true });
} catch (e) {
res.status(500).json({ ok: false });
}
});
export default router;
