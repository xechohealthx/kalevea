# Local DB Allowlist Runbook

Use this whenever `npx prisma db push` (or local DB access) fails with RDS connectivity errors (`P1001`, timeout).

## One-command recovery

From repo root:

```bash
npm run db:allowlist:refresh
```

This script:

1. Detects your current public IP
2. Ensures your `/32` is allowed on Postgres port `5432` in the Kalevea RDS security group
3. Verifies TCP connectivity to the RDS endpoint

Then run:

```bash
npx prisma db push
npx prisma generate
```

## Optional overrides

If security group, region, or endpoint changes:

```bash
RDS_SECURITY_GROUP_ID=sg-xxxxxxxx \
AWS_REGION=us-east-1 \
RDS_HOST=my-db.abcdefg.us-east-1.rds.amazonaws.com \
bash scripts/refresh-rds-allowlist.sh
```

## When to use

- `P1001: Can't reach database server`
- local machine IP changed
- new network / hotspot / VPN

## Notes

- This runbook is for **local admin access recovery**.
- Production app connectivity should continue using your existing Vercel static IP allowlist pattern.
