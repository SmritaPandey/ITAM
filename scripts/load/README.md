# Load testing (k6)

Install k6: `brew install k6` (macOS) or see https://k6.io/docs/get-started/installation/

| Script | Purpose | Safe on prod? |
|---|---|---|
| `k6-smoke.js` | 5 VUs / 30s read-only probe of `/health`, `/health/ready`, web home | Yes |
| `k6-login-load.js` | Authenticated login + list-read load with `baseline` / `standard` / `surge` stages | No — staging/on-prem only |

Examples:

```bash
# Production-safe smoke
k6 run scripts/load/k6-smoke.js

# On-prem sizing validation (100 concurrent users)
k6 run -e BASE_URL=https://your-appliance/api/v1 \
       -e TEST_EMAIL=loadtest@example.com -e TEST_PASSWORD='...' \
       -e STAGE=standard scripts/load/k6-login-load.js
```

Pass criteria are encoded as k6 thresholds (p95/p99 latency, error rate); a
non-zero exit code means the run failed its SLOs. Record results in
`docs/ENTERPRISE_READINESS.md` when used as sizing evidence.
