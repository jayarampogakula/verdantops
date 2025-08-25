// api/src/routes/ingest.ts
import { FastifyInstance } from 'fastify';
import { CarbonEngine } from '../carbon/engine';
import { pool } from '../db';
import { EventSchema, WorkloadEvent } from '../schemas';
import { UsageIngestPayload } from '../types';

function eventToPayload(ev: WorkloadEvent): UsageIngestPayload {
  const started = ev.timestamps.started_at ?? ev.timestamps.ended_at; // fallback if missing
  const ended = ev.timestamps.ended_at;

  // cpu_util_avg & gpu_util_avg are 0..1 in events; convert to %
  const cpuPct = ev.metrics.cpu_util_avg != null ? ev.metrics.cpu_util_avg * 100 : undefined;
  const gpuPct = ev.metrics.gpu_util_avg != null ? ev.metrics.gpu_util_avg * 100 : undefined;

  // region & cloud: region is in event; cloud must come from runtime or labels; default 'azure'
  const region = ev.workload.region ?? 'eastus';
  const cloud = (ev.labels?.['cloud'] as string | undefined)?.toLowerCase() as any ?? 'azure';

  return {
    source: ev.workload.kind === 'spark' ? 'spark' : ev.workload.kind,
    runId: ev.workload.external_id,
    cloud,
    regionCode: region,
    computeType: ev.workload.resource_sku,
    nodeCount: ev.metrics.nodes,
    avgCpuUtilization: cpuPct,
    avgGpuUtilization: gpuPct,
    gpuType: ev.metrics.gpu_type ?? undefined,
    startedAt: started,
    endedAt: ended,
    bytesRead: ev.metrics.bytes_read,
    bytesWritten: ev.metrics.bytes_written,
    // rowsProcessed not in event; leave undefined
  };
}

export default async function ingestRoutes(app: FastifyInstance) {
  const engine = new CarbonEngine(pool);

  // Ingest normalized usage (kept from earlier)
  app.post('/ingest/usage', {
    schema: { body: { type: 'object' } }
  }, async (req, reply) => {
    const token = req.headers['authorization']?.toString().replace('Bearer ', '');
    if (process.env.VERDANTOPS_INGEST_TOKEN && token !== process.env.VERDANTOPS_INGEST_TOKEN) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const payload = req.body as UsageIngestPayload;
    for (const key of ['source','cloud','regionCode','startedAt','endedAt']) {
      // @ts-ignore
      if (!payload[key]) return reply.status(400).send({ error: `missing ${key}` });
    }

    const res = await engine.computeAndInsert(payload);
    return reply.send({
      ok: true,
      id: res.id,
      estKWh: res.estKWh,
      estCo2eKg: res.estCo2eKg,
      gridIntensity_g_per_kWh: res.intensityG
    });
  });

  // Ingest raw events (validated by zod) and map → UsageIngestPayload
  app.post('/ingest/events', async (req, reply) => {
    const token = req.headers['authorization']?.toString().replace('Bearer ', '');
    if (process.env.VERDANTOPS_INGEST_TOKEN && token !== process.env.VERDANTOPS_INGEST_TOKEN) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = EventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const ev = parsed.data;

    // Convert event → normalized payload
    const payload = eventToPayload(ev);

    // Let CarbonEngine compute kWh/CO2e (uses collector values if present)
    const res = await engine.computeAndInsert(payload);

    return reply.send({
      ok: true,
      id: res.id,
      estKWh: res.estKWh,
      estCo2eKg: res.estCo2eKg,
      gridIntensity_g_per_kWh: res.intensityG
    });
  });
}
