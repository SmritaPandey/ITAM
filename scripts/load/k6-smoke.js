// k6 smoke test — safe read-only probe of public endpoints.
// Run: k6 run scripts/load/k6-smoke.js
// Override target: k6 run -e BASE_URL=http://localhost:4100/api/v1 scripts/load/k6-smoke.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://api-production-fe27.up.railway.app/api/v1";
const WEB = __ENV.WEB_URL || "https://www.qsasset.com";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health body ok": (r) => r.json("status") === "healthy",
  });

  const ready = http.get(`${BASE}/health/ready`);
  check(ready, { "ready 200": (r) => r.status === 200 });

  const home = http.get(WEB);
  check(home, { "web 200": (r) => r.status === 200 });

  sleep(1);
}
