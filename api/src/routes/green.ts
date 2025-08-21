// api/src/routes/green.ts
import { FastifyInstance } from 'fastify';
import { pool } from '../db';
import { CarbonEngine } from '../carbon/engine';

export default async function greenRoutes(app: FastifyInstance) {
  const engine = new CarbonEngine(pool);

  // /metrics/green-score
  app.get('/metrics/green-score', async (req, reply) => {
    const url = new URL(req.url, 'http://dummy');
    const from = url.searchParams.get('from') ?? new Date(Date.now() - 30*24*3600*1000).toISOString();
    const to   = url.searchParams.get('to')   ?? new Date().toISOString();
    const targetKgPerTB = Number(url.searchParams.get('targetKgPerTB') ?? 5);
    const targetFreshnessHours = Number(url.searchParams.get('targetFreshnessHours') ?? 24);

    const totalsQ = `
      SELECT COALESCE(SUM(est_co2e_kg),0) AS co2e,
             COALESCE(SUM(COALESCE(bytes_read,0) + COALESCE(bytes_written,0)),0) AS bytes_io
      FROM workloads
      WHERE started_at >= $1 AND started_at < $2
    `;
    const latestRunQ = `SELECT MAX(ended_at) AS last_ended FROM workloads`;
    const partQ = `
      SELECT AVG(COALESCE( (raw->>'partitionedScanPct')::numeric, 0.5)) AS avg_part
      FROM workloads
      WHERE started_at >= $1 AND started_at < $2
    `;

    const [totals, latest, part] = await Promise.all([
      pool.query(totalsQ, [from, to]),
      pool.query(latestRunQ),
      pool.query(partQ, [from, to])
    ]);

    const co2e = Number(totals.rows[0].co2e ?? 0);
    const bytesIO = Number(totals.rows[0].bytes_io ?? 0);
    const tb = bytesIO / (1024 ** 4);
    const kgPerTB = tb > 0 ? co2e / tb : 0;

    let effScore = 100;
    if (kgPerTB > 0 && targetKgPerTB > 0) {
      effScore = Math.max(0, Math.min(100, 100 * (targetKgPerTB / kgPerTB)));
      if (kgPerTB <= targetKgPerTB) effScore = 100;
    }

    const lastEndedISO = latest.rows[0]?.last_ended ? new Date(latest.rows[0].last_ended).toISOString() : null;
    const ageHours = lastEndedISO ? (Date.now() - new Date(lastEndedISO).getTime()) / 3_600_000 : Infinity;
    let freshScore = 0;
    if (isFinite(ageHours) && ageHours > 0 && targetFreshnessHours > 0) {
      freshScore = ageHours <= targetFreshnessHours
        ? 100
        : Math.max(0, Math.min(100, 100 * (targetFreshnessHours / ageHours)));
    }

    const partitionedAvg = Number(part.rows[0]?.avg_part ?? 0.5);
    const partScore = Math.max(0, Math.min(100, partitionedAvg * 100));

    const overall = Number((effScore*0.5 + partScore*0.3 + freshScore*0.2).toFixed(2));

    return reply.send({
      window: { from, to },
      metrics: {
        co2eKg: co2e,
        bytesIO,
        tbProcessed: tb,
        kgPerTB
      },
      components: {
        efficiencyScore: Number(effScore.toFixed(2)),
        partitioningScore: Number(partScore.toFixed(2)),
        freshnessScore: Number(freshScore.toFixed(2))
      },
      overall
    });
  });

  // /metrics/hotspots
  app.get('/metrics/hotspots', async (req, reply) => {
    const url = new URL(req.url, 'http://dummy');
    const from = url.searchParams.get('from') ?? new Date(Date.now() - 30*24*3600*1000).toISOString();
    const to   = url.searchParams.get('to')   ?? new Date().toISOString();
    const limit = Number(url.searchParams.get('limit') ?? 10);

    const q = `
      SELECT
        source,
        run_id,
        MAX(compute_type) AS compute_type,
        MAX(region_code)  AS region_code,
        COUNT(*)          AS runs,
        SUM(est_kwh)      AS kwh,
        SUM(est_co2e_kg)  AS co2e_kg,
        SUM(COALESCE(bytes_read,0) + COALESCE(bytes_written,0)) AS bytes_io,
        MAX(ended_at)     AS last_run_at
      FROM workloads
      WHERE started_at >= $1 AND started_at < $2
      GROUP BY source, run_id
      ORDER BY co2e_kg DESC
      LIMIT $3
    `;
    const { rows } = await pool.query(q, [from, to, limit]);

    return reply.send({
      window: { from, to },
      items: rows.map(r => ({
        source: r.source,
        runId: r.run_id,
        computeType: r.compute_type,
        regionCode: r.region_code,
        runs: Number(r.runs),
        kwh: Number(r.kwh),
        co2eKg: Number(r.co2e_kg),
        bytesIO: Number(r.bytes_io),
        lastRunAt: r.last_run_at
      }))
    });
  });

  // /alerts
  app.get('/alerts', async (req, reply) => {
    const url = new URL(req.url, 'http://dummy');
    const limit = Number(url.searchParams.get('limit') ?? 50);

    const q = `
      SELECT a.id, a.created_at, a.kind, a.severity, a.message, a.meta,
             w.source, w.run_id, w.region_code, w.compute_type, w.est_co2e_kg, w.started_at, w.ended_at
      FROM alerts a
      LEFT JOIN workloads w ON w.id = a.workload_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `;
    const { rows } = await pool.query(q, [limit]);

    return reply.send({
      items: rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        kind: r.kind,
        severity: r.severity,
        message: r.message,
        meta: r.meta,
        workload: {
          source: r.source,
          runId: r.run_id,
          regionCode: r.region_code,
          computeType: r.compute_type,
          co2eKg: Number(r.est_co2e_kg ?? 0),
          startedAt: r.started_at,
          endedAt: r.ended_at
        }
      }))
    });
  });
}
