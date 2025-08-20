import { Router } from "express";
duration_ms: z.number().int().nonnegative().default(1),
cpu_util_avg: z.number().min(0).max(1).default(0.6),
nodes: z.number().int().positive().default(1),
gpu_type: z.string().nullable().optional(),
gpu_util_avg: z.number().min(0).max(1).nullable().optional(),
bytes_read: z.number().int().nonnegative().optional(),
bytes_written: z.number().int().nonnegative().optional(),
}),
timestamps: z.object({
started_at: z.string().datetime().optional(),
ended_at: z.string().datetime(),
}),
labels: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});


router.post("/ingest/events", async (req, res) => {
const parsed = EventSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
const ev = parsed.data;


const duration = ev.metrics.duration_ms;
const utilization = ev.metrics.gpu_util_avg ?? ev.metrics.cpu_util_avg ?? 0.6;
const nodes = ev.metrics.nodes ?? 1;


const kWh = estimateEnergyKWh({
region: ev.workload.region,
resource_sku: ev.workload.resource_sku,
duration_ms: duration,
utilization
}, nodes);


const co2 = estimateCO2eKg({
region: ev.workload.region,
resource_sku: ev.workload.resource_sku,
duration_ms: duration,
utilization
}, nodes);


const client = await pool.connect();
try {
await client.query("BEGIN");
const { rows } = await client.query(
`INSERT INTO workload (org_id, project_id, external_id, name, kind)
VALUES ($1,$2,$3,$4,$5)
ON CONFLICT (project_id, external_id) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind
RETURNING id`,
[ev.org_id, ev.project_id, ev.workload.external_id, ev.workload.name ?? null, ev.workload.kind]
);
const workloadId = rows[0].id;


await client.query(
`INSERT INTO emissions (workload_id, ended_at, duration_ms, nodes, region, resource_sku, kwh, kg_co2e)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
[workloadId, ev.timestamps.ended_at, duration, nodes, ev.workload.region, ev.workload.resource_sku, kWh, co2]
);


await client.query("COMMIT");
res.json({ ok: true, workload_id: workloadId, kWh, kg_co2e: co2 });
} catch (e) {
await client.query("ROLLBACK");
console.error(e);
res.status(500).json({ error: "db_error" });
} finally {
client.release();
}
});


export default router;
