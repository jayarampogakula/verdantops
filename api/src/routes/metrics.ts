import { Router } from "express";
import pool from "../db";

const router = Router();

// GET /metrics → return all ingested jobs with carbon impact
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT job_id, energy_kwh, co2_kg, created_at FROM job_metrics ORDER BY created_at DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching metrics:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

export default router;
