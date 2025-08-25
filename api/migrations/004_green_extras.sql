-- Alerts table: records budget breaches and other signals
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  workload_id BIGINT REFERENCES workloads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'budget_breach'
  severity TEXT NOT NULL,             -- 'warning' | 'critical'
  message TEXT NOT NULL,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS alerts_created_idx ON alerts (created_at DESC);

-- OPTIONAL: per-run budgets (kg CO2e per run)
CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,        -- 'databricks' | 'spark' | ...
  run_id TEXT NOT NULL,        -- job/run identifier
  kg_co2e_budget NUMERIC(18,6) NOT NULL,
  UNIQUE (source, run_id)
);
