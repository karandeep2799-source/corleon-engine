import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const app = Fastify({ logger: true });
await app.register(helmet);
await app.register(cors, { origin: true });

app.get('/health', async () => ({ status: 'ok', service: 'corleon-api', version: '0.1.0' }));

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
