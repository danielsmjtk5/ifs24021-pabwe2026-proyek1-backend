import { createApp } from './app.js';
import { closeDb, getDb } from './config/database.js';
import env from './config/env.js';

getDb();
const app = createApp();

// Host opsional (mis. APP_HOST=127.0.0.1 dari panel hosting); default semua interface.
const host = process.env.APP_HOST || process.env.HOST || undefined;
const server = app.listen(env.port, host, () => {
  console.log(`AsramaCare API berjalan di http://${host || 'localhost'}:${env.port} (${env.nodeEnv})`);
});

function shutdown() {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
