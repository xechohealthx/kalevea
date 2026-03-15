## Kalevea

Kalevea is a production-grade **multi-tenant SaaS/PWA operations platform** for a treatment-network MSO.

Kalevea is **not an EMR**. It’s the operating system around the EMR for clinic onboarding, provider/staff management, operational support, documents, training, auditability, and modular engines (starting with **REMS MVP**).

## Getting started (local dev)

### Prereqs

- Node.js + npm
- PostgreSQL

### Environment

Create `.env`:

- `DATABASE_URL=postgresql://...`
- `NEXTAUTH_SECRET=...` (any long random string for local dev)

### Database + seed

```bash
npm run db:push
npm run db:seed
```

### Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Dev login

Use any seeded demo account with password: `password`

- `superadmin@kalevea.local`
- `exec@kalevea.local`
- `impl@kalevea.local`
- `support@kalevea.local`
- `billing@kalevea.local`
- `compliance@kalevea.local`
- `clinicadmin@northside.local`
- `provider@lakeshore.local`
- `readonly@riverside.local`

## Docs

- `kalevea_context.md`
- `docs/architecture/kalevea-core.md`
- `docs/architecture/rems-mvp.md`
- `docs/product/kalevea-mvp-modules.md`
