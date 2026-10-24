import { closeDb, initDb } from '../src/config/database.js';
import env from '../src/config/env.js';

await initDb();
console.log(`Migrasi selesai pada database: ${env.databaseUrl}`);
closeDb();
