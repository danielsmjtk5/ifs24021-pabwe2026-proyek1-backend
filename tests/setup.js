import { afterEach, beforeEach } from 'vitest';
import { closeDb, openDatabase, setDb } from '../src/config/database.js';

// Setiap test memakai database SQLite in-memory yang baru, terpisah dari data aplikasi.
beforeEach(async () => {
  setDb(await openDatabase(':memory:'));
});

afterEach(() => {
  closeDb();
});
