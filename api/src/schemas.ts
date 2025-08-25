// api/src/schemas.ts
import { z } from 'zod';

export const EventSchema = z.object({
  event_type: z.string(),
  org_id: z.string(),
  project_id: z.string(),
  workload: z.object({
    external_id: z.string(),
    name: z.string().optional(),
    kind: z.enum(['spark','sql','ml']),
    region: z.string().optional(),        // e.g., "eastus"
    resource_sku: z.string().optional(),  // e.g., "Standard_D8_v5"
  }),
  metrics: z.object({
    duration_ms: z.number().int().nonnegative().default(1),
    cpu_util_avg: z.number().min(0).max(1).default(0.6),
    mem_gb: z.number().optional(),
    bytes_read: z.number().int().nonnegative().optional(),
    bytes_written: z.number().int().nonnegative().optional(),
    nodes: z.number().int().positive().default(1),
    gpu_type: z.string().nullable().optional(),
    gpu_util_avg: z.number().min(0).max(1).nullable().optional(),
  }),
  timestamps: z.object({
    started_at: z.string().datetime().optional(),
    ended_at: z.string().datetime(),
  }),
  labels: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});
export type WorkloadEvent = z.infer<typeof EventSchema>;
