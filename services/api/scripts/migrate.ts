import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const dbDir = resolve(process.cwd(), 'db');
    const files = (await readdir(dbDir))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const file of files) {
      const sql = await readFile(resolve(dbDir, file), 'utf8');
      await pool.query(sql);
      console.log(`Migration ${file} applied`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
