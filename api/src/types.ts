// api/src/types.ts

export type WorkloadEvent = {
  event_type: string; // e.g., "spark_job_end"
  org_id: string;
  project_id: string;
  workload: {
    external_id: string; // job/run id
    name?: string;
    kind: "spark" | "sql" | "ml";
    region?: string;        // e.g., "eastus"
    resource_sku?: string;  // e.g., "Standard_D8_v5" or "NVIDIA_T4"
  };
  metrics: {
    duration_ms?: number;
    cpu_util_avg?: number; // 0..1
    mem_gb?: number;
    bytes_read?: number;
    bytes_written?: number;
    nodes?: number;        // cluster size
    gpu_type?: string | null;
    gpu_util_avg?: number | null; // 0..1
  };
  timestamps: {
    started_at?: string; // ISO
    ended_at: string;    // ISO
  };
  labels?: Record<string, string | number | boolean>;
};

export type Cloud = 'azure' | 'aws' | 'gcp' | 'onprem';

export interface UsageIngestPayload {
  source: 'databricks' | 'spark' | 'adf' | string;
  runId?: string;
  cloud: Cloud;
  regionCode: string;               // e.g., 'eastus', 'us-east-1', 'europe-west1'
  computeType?: string;             // VM/node type
  nodeCount?: number;
  avgCpuUtilization?: number;       // 0..100
  avgGpuUtilization?: number;       // 0..100 (NEW, optional)
  gpuType?: string;                 // e.g., "NVIDIA_T4"
  startedAt: string;                // ISO
  endedAt: string;                  // ISO
  dbu?: number;                     // optional (Databricks)
  bytesRead?: number;
  bytesWritten?: number;
  rowsProcessed?: number;

  // Optional direct energy inputs (if the collector can compute them)
  estKWh?: number;
}

export interface CarbonSummary {
  from: string;
  to: string;
  totals: {
    kwh: number;
    co2eKg: n
