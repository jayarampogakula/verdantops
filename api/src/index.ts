import express from "express";
import bodyParser from "body-parser";
import ingestRoutes from "./routes/ingest";
import healthRoutes from "./routes/health";
import metricsRoutes from "./routes/metrics"; // <-- add this

const app = express();
const port = process.env.API_PORT || 4000;

app.use(bodyParser.json());

app.use("/ingest", ingestRoutes);
app.use("/health", healthRoutes);
app.use("/metrics", metricsRoutes); // <-- add this

app.listen(port, () => {
  console.log(`✅ API server running on port ${port}`);
});
