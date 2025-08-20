# VerdantOps 🌱
**Green DataOps Toolkit — Powered by Learnbricks Academy**

VerdantOps helps Data Engineers, Analysts, and AI Engineers measure and reduce the **carbon impact** of data pipelines.  
This MVP includes:
- Databricks Collector → captures Spark job usage
- Carbon Engine v0 → converts usage to kWh & CO₂e
- Ingest API → stores metrics in Postgres
- Dashboard (Next.js) → visualize emissions by job

---

## 🚀 Quick Start (Docker)

```bash
# Clone repo
git clone https://github.com/jayarampogakula/verdantops.git
cd verdantops

# Copy environment config
cp .env.example .env

# Start stack
docker-compose up --build
