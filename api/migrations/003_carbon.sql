-- Regions & emission factors (gCO2e/kWh)
CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    cloud TEXT NOT NULL,                 -- 'azure' | 'aws' | 'gcp' | 'onprem'
    region_code TEXT NOT NULL,           -- e.g., 'eastus', 'us-east-1'
    description TEXT,
    grid_intensity_g_per_kwh INTEGER NOT NULL,  -- gCO2e/kWh
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cloud, region_code)
);

-- Workloads ingested from collectors
CREATE TABLE IF NOT EXISTS workloads (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,                -- 'databricks', 'spark', 'adf', etc.
    run_id TEXT,                         -- job/run identifier
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    cloud TEXT NOT NULL,
    region_code TEXT NOT NULL,
    compute_type TEXT,                   -- e.g., 'Standard_D8ds_v5'
    node_count INTEGER,
    avg_cpu_utilization NUMERIC(5,2),    -- 0..100
    dbu NUMERIC(12,4),                   -- optional (databricks units)
    bytes_read BIGINT,
    bytes_written BIGINT,
    rows_processed BIGINT,
    est_kwh NUMERIC(18,6) NOT NULL,      -- estimated energy use
    est_co2e_kg NUMERIC(18,6) NOT NULL,  -- estimated kg CO2e
    raw JSONB                            -- full original payload for traceability
);

CREATE INDEX IF NOT EXISTS workloads_started_idx ON workloads (started_at);
CREATE INDEX IF NOT EXISTS workloads_region_idx ON workloads (cloud, region_code);
CREATE INDEX IF NOT EXISTS workloads_source_idx ON workloads (source);

-- Rollup (materialized view for quick charts)
CREATE MATERIALIZED VIEW IF NOT EXISTS carbon_daily AS
SELECT
  date_trunc('day', started_at) AS day,
  cloud, region_code,
  SUM(est_kwh) AS kwh,
  SUM(est_co2e_kg) AS co2e_kg,
  SUM(bytes_read + bytes_written) AS bytes_io
FROM workloads
GROUP BY 1,2,3;

CREATE INDEX IF NOT EXISTS carbon_daily_day_idx ON carbon_daily (day);

-- Helper to refresh quickly
CREATE OR REPLACE FUNCTION refresh_carbon_daily() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY carbon_daily;
END $$;
