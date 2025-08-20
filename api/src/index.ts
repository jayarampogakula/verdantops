import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import { migrate } from "./db.js";
import ingest from "./routes/ingest.js";
import health from "./routes/health.js";


const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(health);
app.use(ingest);


const port = Number(process.env.API_PORT ?? 8080);


if (process.argv[2] === "migrate") {
migrate().then(() => process.exit(0));
} else {
app.listen(port, () => console.log(`VerdantOps API running on :${port}`));
}
