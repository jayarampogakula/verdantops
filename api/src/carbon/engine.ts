// Minimal pluggable carbon/energy estimator.
// E = t(h) * P_avg(kW) * U * PUE ; CO2e = E * CI


export type CarbonInputs = {
region: string; // e.g., "eastus"
resource_sku: string; // VM or GPU type
duration_ms: number;
utilization: number; // 0..1 (CPU or GPU dominant)
};


// Simple maps. In production, load from DB/registry.
const SKU_POWER_KW: Record<string, number> = {
// Approximate average platform power per node under load.
// CPU nodes
"Standard_D8_v5": 0.20,
"Standard_E8_v5": 0.24,
// GPU nodes
"Standard_NC4as_T4_v3": 0.35, // 1x T4
"Standard_NC6s_v3": 0.60, // V100 approx
};


const REGION_CI_KG_PER_KWH: Record<string, number> = {
"eastus": 0.35,
"westus2": 0.30,
"westeurope": 0.20,
"uksouth": 0.23
};


const PROVIDER_PUE = 1.2; // v0 constant; make region/provider specific later.


export function estimateEnergyKWh(inp: CarbonInputs, nodes = 1): number {
const P = SKU_POWER_KW[inp.resource_sku] ?? 0.20; // fallback
const t = Math.max(inp.duration_ms, 1) / 3_600_000; // ms -> hours
const U = Math.min(Math.max(inp.utilization, 0.05), 1);
return t * P * U * PROVIDER_PUE * nodes;
}


export function estimateCO2eKg(inp: CarbonInputs, nodes = 1): number {
const E = estimateEnergyKWh(inp, nodes);
const CI = REGION_CI_KG_PER_KWH[inp.region] ?? 0.35;
return E * CI;
}
