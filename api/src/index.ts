import Fastify from 'fastify';
import cors from '@fastify/cors'; 
import healthRoutes from './routes/health';
import ingestRoutes from './routes/ingest';
import metricsRoutes from './routes/metrics';
import greenRoutes from './routes/green';
import { migrate } from './db';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.register(healthRoutes);
app.register(ingestRoutes);
app.register(metricsRoutes);
app.register(greenRoutes);

const port = Number(process.env.PORT ?? 8080);

(async () => {
  try {
    await migrate();
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
