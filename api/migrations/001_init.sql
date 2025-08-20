create table if not exists org (
id uuid primary key default gen_random_uuid(),
name text not null
);


create table if not exists project (
id uuid primary key default gen_random_uuid(),
org_id uuid not null,
key text not null,
name text,
unique (org_id, key)
);


create table if not exists workload (
id bigserial primary key,
org_id uuid not null,
project_id uuid not null,
external_id text not null,
name text,
kind text not null,
unique (project_id, external_id)
);


create table if not exists emissions (
id bigserial primary key,
workload_id bigint not null references workload(id),
ended_at timestamptz not null,
duration_ms bigint not null,
nodes int not null,
region text not null,
resource_sku text not null,
kwh double precision not null,
kg_co2e double precision not null
);

CREATE TABLE IF NOT EXISTS job_metrics (
    id SERIAL PRIMARY KEY,
    job_id TEXT NOT NULL,
    duration_ms BIGINT,
    executor_cores INT,
    executor_memory_gb INT,
    energy_kwh DOUBLE PRECISION,
    co2_kg DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW()
);
