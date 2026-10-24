import { getDb, closeDb } from '../src/config/database.js';
import env from '../src/config/env.js';

getDb();
console.log(`Migrasi selesai pada database: ${env.dbPath}`);
closeDb();
