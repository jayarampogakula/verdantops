import { Pool } from 'pg';
import { UsageIngestPayload } from '../types';

const DEFAULT_INTENSITY =
  Number(process.env.CARBON_DEFAULT_GRID_INTENSITY_G_PER_KWH ?? 450);

const RUN_BUDGET_KG = process.env.CARBON_BUDGET_KG_PER_RUN
  ? Number(process.env.CARBON_BUDGET_KG_PER_RUN)
  : undefined;

export class CarbonEngine {
  constructor(private pool: Pool) {}

  async getGridIntensityGPerKwh(cloud: string, regionCode: string): Promise<number> {
    const q = `SELECT grid_intensity_g_per_kwh FROM regions WHERE cloud=$1 AND region_code=$2`;
    const { rows } = await this.pool.query(q, [cloud, regionCode]);
    if (rows[0]?.grid_intensity_g_per_kwh) return Number(rows[0].grid_intensity_g_per_kwh);
    return DEFAULT_INTENSITY;
  }

  /**
   * Fallback energy estimate if collector doesn't send estKWh.
   * Super-simple model:
   *   kWh = nodeCount * hours * (watts_for_computeType / 1000) * utilization
   * If computeType unknown, assume 150W per vCPU-equivalent ~ 1 core, 8-core default.
   */
  estimateKWhFallback(p: UsageIngestPayload): number {
    const nodeCount = p.nodeCount ?? 1;
    const util = Math.min(Math.max((p.avgCpuUtilization ?? 55) / 100, 0), 1);
    const start = new Date(p.startedAt).getTime();
    const end = new Date(p.endedAt).getTime();
    const hours = Math.max((end - start) / 3_600_000, 0.01);

    // crude watts lookup
    const wattsLookup: Record<string, number> = {
      // common Azure shapes (very rough ballparks)
      'Standard_D8ds_v5': 180, 'Standard_D16ds_v5': 320,
      // AWS
      'm5.xlarge': 120, 'm5.2xlarge': 220,
      // GCP
      'n2-standard-8': 180, 'n2-standard-16': 320
    };
    const defaultWatts = 8 * 15; // 8 vCPU * 15W = 120W
    const watts = wattsLookup[p.computeType ?? ''] ?? defaultWatts;

    const kwh = nodeCount * hours * (watts / 1000) * util;
    return Number(kwh.toFixed(6));
  }
  
  private async getRunBudgetKg(source?: string, runId?: string): Promise<number | undefined> {
    if (!source || !runId) return RUN_BUDGET_KG;
    const q = `SELECT kg_co2e_budget FROM budgets WHERE source=$1 AND run_id=$2`;
    const { rows } = await this.pool.query(q, [source, runId]);
    if (rows[0]?.kg_co2e_budget != null) return Number(rows[0].kg_co2e_budget);
    return RUN_BUDGET_KG;
  }

  // NEW: create alert row
  private async createAlert(workloadId: number, severity: 'warning'|'critical', message: string, meta?: any) {
    await this.pool.query(
      `INSERT INTO alerts (workload_id, kind, severity, message, meta)
       VALUES ($1,$2,$3,$4,$5)`,
      [workloadId, 'budget_breach', severity, message, meta ? JSON.stringify(meta) : null]
    );
  }
  async computeAndInsert(payload: UsageIngestPayload) {
    const intensityG = await this.getGridIntensityGPerKwh(payload.cloud, payload.regionCode);
    const estKWh = payload.estKWh ?? this.estimateKWhFallback(payload);
    const estCo2eKg = Number(((estKWh * intensityG) / 1000).toFixed(6)); // g→kg

    const q = `
      INSERT INTO workloads
        (source, run_id, started_at, ended_at, cloud, region_code, compute_type, node_count,
         avg_cpu_utilization, dbu, bytes_read, bytes_written, rows_processed, est_kwh, est_co2e_kg, raw)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id
    `;
    const values = [
      payload.source,
      payload.runId ?? null,
      payload.startedAt,
      payload.endedAt,
      payload.cloud,
      payload.regionCode,
      payload.computeType ?? null,
      payload.nodeCount ?? null,
      payload.avgCpuUtilization ?? null,
      payload.dbu ?? null,
      payload.bytesRead ?? null,
      payload.bytesWritten ?? null,
      payload.rowsProcessed ?? null,
      estKWh,
      estCo2eKg,
      JSON.stringify(payload)
    ];

    const { rows } = await this.pool.query(q, values);
    // refresh MV asynchronously
    this.pool.query('SELECT refresh_carbon_daily()').catch(()=>{});

    const budget = await this.getRunBudgetKg(payload.source, payload.runId);
    if (budget != null && estCo2eKg > budget) {
      const severity = estCo2eKg > budget * 1.5 ? 'critical' : 'warning';
      const overBy = Number((estCo2eKg - budget).toFixed(6));
      await this.createAlert(workloadId, severity,
        `Run exceeded CO₂e budget by ${overBy} kg (budget ${budget}, actual ${estCo2eKg})`,
        { budgetKg: budget, actualKg: estCo2eKg, intensity_g_per_kWh: intensityG }
      );
    }
    
    return {  id: workloadId, estKWh, estCo2eKg, intensityG };
  }

  async summary(fromISO: string, toISO: string) {
    const qTotals = `
      SELECT COALESCE(SUM(est_kwh),0) kwh,
             COALESCE(SUM(est_co2e_kg),0) co2e_kg,
             COALESCE(SUM(bytes_read + bytes_written),0) bytes_io
      FROM workloads WHERE started_at >= $1 AND started_at < $2
    `;
    const qDaily = `
      SELECT to_char(day,'YYYY-MM-DD') AS day, kwh, co2e_kg, bytes_io
      FROM carbon_daily WHERE day >= $1 AND day < $2
      ORDER BY day
    `;
    const [totals, daily] = await Promise.all([
      this.pool.query(qTotals, [fromISO, toISO]),
      this.pool.query(qDaily,  [fromISO, toISO])
    ]);

    return {
      from: fromISO,
      to: toISO,
      totals: {
        kwh: Number(totals.rows[0].kwh ?? 0),
        co2eKg: Number(totals.rows[0].co2e_kg ?? 0),
        bytesIO: Number(totals.rows[0].bytes_io ?? 0)
      },
      byDay: daily.rows.map((r: any)=>({
        day: r.day,
        kwh: Number(r.kwh),
        co2eKg: Number(r.co2e_kg),
        bytesIO: Number(r.bytes_io)
      }))
    };
  }
}
