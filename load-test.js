// k6 smoke/load test — anonymous public pages only.
//
//   k6 run -e BASE_URL=http://localhost:3000 --summary-export=load-results.json load-test.js
//
// Run it against a PRODUCTION build (`npm run build && npm start`), not `next dev`
// (dev mode compiles on demand and is many times slower). Record the numbers in the thesis.
// The thresholds below make k6 exit non-zero (fail) when they are violated.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // ramp up
    { duration: '30s', target: 50 }, // hold
    { duration: '10s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // < 1 % errors
    http_req_duration: ['p(95)<1500'],   // 95 % of requests under 1.5 s
    checks: ['rate>0.99'],               // > 99 % of status checks pass
  },
};

export default function () {
  for (const [name, path] of [['homepage', '/'], ['marketplace', '/marketplace'], ['courses', '/courses']]) {
    const res = http.get(`${BASE}${path}`, { tags: { page: name } });
    check(res, { [`${name} 200`]: (r) => r.status === 200 });
  }
  sleep(1);
}
