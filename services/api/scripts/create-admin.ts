import { Pool } from 'pg';
import { hashPassword } from '../src/modules/auth/password';

async function main() {
  const [, , email, password, role = 'super_admin', displayName = 'YD Play Admin'] = process.argv;
  if (!email || !password) {
    throw new Error('Usage: npm run admin:create -- admin@example.com "strong-password" [role] [display-name]');
  }
  if (password.length < 12) throw new Error('Admin password must be at least 12 characters');
  const allowed = ['support','moderator','analyst','operator','admin','super_admin'];
  if (!allowed.includes(role)) throw new Error(`Role must be one of: ${allowed.join(', ')}`);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString });
  try {
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO admin_users (email,password_hash,display_name,role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET
         password_hash=EXCLUDED.password_hash,
         display_name=EXCLUDED.display_name,
         role=EXCLUDED.role,
         is_active=true,
         updated_at=now()
       RETURNING id,email,display_name,role,is_active`,
      [email, passwordHash, displayName, role]
    );
    console.log(JSON.stringify(result.rows[0], null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
