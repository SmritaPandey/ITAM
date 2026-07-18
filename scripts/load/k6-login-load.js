// k6 login + authenticated read load test.
// DO NOT run against production without agreement — this creates real sessions.
// Intended for staging / on-prem sizing validation.
//
// Run: k6 run -e BASE_URL=http://localhost:4100/api/v1 \
//             -e TEST_EMAIL=loadtest@example.com -e TEST_PASSWORD=... \
//             -e STAGE=baseline scripts/load/k6-login-load.js
//
// Stages:
//   baseline — 10 VUs, 1m   (sanity)
//   standard — 100 VUs, 5m  (small enterprise)
//   surge    — 1000 VUs, 10m (peak sizing; needs HA compose)
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:4100/api/v1";
const EMAIL = __ENV.TEST_EMAIL;
const PASSWORD = __ENV.TEST_PASSWORD;

const STAGES = {
  baseline: [{ duration: "1m", target: 10 }],
  standard: [
    { duration: "1m", target: 100 },
    { duration: "3m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  surge: [
    { duration: "2m", target: 250 },
    { duration: "3m", target: 1000 },
    { duration: "4m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
};

export const options = {
  stages: STAGES[__ENV.STAGE || "baseline"],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    checks: ["rate>0.98"],
  },
};

export function setup() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD (non-MFA test account)");
  }
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  const token = res.json("accessToken");
  if (!token) throw new Error(`Login failed: ${res.status} ${res.body}`);
  return { token };
}

export default function (data) {
  const params = { headers: { Authorization: `Bearer ${data.token}` } };

  const assets = http.get(`${BASE}/assets?limit=20`, params);
  check(assets, { "assets 200": (r) => r.status === 200 });

  const tickets = http.get(`${BASE}/tickets?limit=20`, params);
  check(tickets, { "tickets 200": (r) => r.status === 200 });

  const dash = http.get(`${BASE}/health/capabilities`, params);
  check(dash, { "capabilities 200": (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1);
}
