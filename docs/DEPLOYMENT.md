# Local deployment

1. Copy `.env.example` to `.env`.
2. Replace both JWT secrets.
3. Start PostgreSQL and Redis:
   `docker compose up -d postgres redis`
4. Install dependencies:
   `npm install`
5. Run migration:
   `npm run db:migrate`
6. Start API:
   `npm run dev:api`
7. Open:
   `http://localhost:3000/v1/health`

# Production notes

Do not reuse the example secrets or database password.

Before production:
- use managed secrets,
- run PostgreSQL with encrypted backups,
- terminate TLS at a trusted ingress/load balancer,
- enable application and infrastructure rate limiting,
- restrict database roles,
- add central logs/metrics/alerts,
- run migrations as a separate deployment step,
- run the security test plan and penetration test.
