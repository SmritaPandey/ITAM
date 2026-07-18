import {
  getProcessRole,
  shouldRunCollectors,
  shouldRunCrons,
  shouldRunQueueWorkers,
  shouldServeHttp,
} from './process-role';

describe('process-role helpers', () => {
  const prevRole = process.env.PROCESS_ROLE;
  const prevCron = process.env.DISABLE_CRON_JOBS;

  afterEach(() => {
    if (prevRole === undefined) delete process.env.PROCESS_ROLE;
    else process.env.PROCESS_ROLE = prevRole;
    if (prevCron === undefined) delete process.env.DISABLE_CRON_JOBS;
    else process.env.DISABLE_CRON_JOBS = prevCron;
  });

  it('defaults to all', () => {
    delete process.env.PROCESS_ROLE;
    delete process.env.DISABLE_CRON_JOBS;
    expect(getProcessRole()).toBe('all');
    expect(shouldRunCrons()).toBe(true);
    expect(shouldRunCollectors()).toBe(true);
  });

  it('api role disables crons and collectors', () => {
    process.env.PROCESS_ROLE = 'api';
    expect(shouldRunCrons()).toBe(false);
    expect(shouldServeHttp()).toBe(true);
    expect(shouldRunCollectors()).toBe(false);
  });

  it('DISABLE_CRON_JOBS overrides worker', () => {
    process.env.PROCESS_ROLE = 'worker';
    process.env.DISABLE_CRON_JOBS = 'true';
    expect(shouldRunCrons()).toBe(false);
    expect(shouldRunQueueWorkers()).toBe(true);
  });
});
