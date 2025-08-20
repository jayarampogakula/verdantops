export type WorkloadEvent = {
event_type: string; // e.g., "spark_job_end"
org_id: string;
project_id: string;
workload: {
external_id: string; // job/run id
name?: string;
kind: "spark" | "sql" | "ml";
region?: string; // e.g., "eastus"
resource_sku?: string; // e.g., "Standard_D8_v5" or "NVIDIA_T4"
};
metrics: {
duration_ms?: number;
cpu_util_avg?: number; // 0..1
mem_gb?: number;
bytes_read?: number;
bytes_written?: number;
nodes?: number; // cluster size
gpu_type?: string | null;
gpu_util_avg?: number | null; // 0..1
};
timestamps: {
started_at?: string; // ISO
ended_at: string; // ISO
};
labels?: Record<string, string | number | boolean>;
};
