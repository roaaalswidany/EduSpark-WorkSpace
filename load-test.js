import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '20s',
};

export default function () {
  let res = http.get('http://localhost:3000/');
  check(res, { 'homepage 200': (r) => r.status === 200 });

  res = http.get('http://localhost:3000/marketplace');
  check(res, { 'marketplace 200': (r) => r.status === 200 });

  res = http.get('http://localhost:3000/courses');
  check(res, { 'courses 200': (r) => r.status === 200 });

  sleep(1);
}