import { calculateNextRun } from './cron-next-run';

describe('calculateNextRun', () => {
  it('computes next daily run from a 5-field cron', () => {
    const from = new Date('2026-07-18T10:00:00.000Z');
    const next = calculateNextRun('0 6 * * *', from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getUTCHours()).toBe(6);
    expect(next.getUTCMinutes()).toBe(0);
  });

  it('computes next weekly weekday', () => {
    const from = new Date('2026-07-18T10:00:00.000Z'); // Saturday
    const next = calculateNextRun('30 9 * * 1', from);
    expect(next.getUTCDay()).toBe(1);
    expect(next.getUTCHours()).toBe(9);
    expect(next.getUTCMinutes()).toBe(30);
  });

  it('falls back to +24h for invalid expressions', () => {
    const from = new Date('2026-07-18T10:00:00.000Z');
    const next = calculateNextRun('not-a-cron', from);
    expect(next.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
