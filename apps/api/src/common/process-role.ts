export type ProcessRole = 'all' | 'api' | 'worker' | 'collector';

export function getProcessRole(): ProcessRole {
  const raw = (process.env.PROCESS_ROLE || 'all').toLowerCase();
  if (raw === 'api' || raw === 'worker' || raw === 'collector' || raw === 'all') {
    return raw;
  }
  return 'all';
}

/** Cron / ScheduleModule should run on worker or all (not pure api/collector). */
export function shouldRunCrons(): boolean {
  if (process.env.DISABLE_CRON_JOBS === 'true') return false;
  const role = getProcessRole();
  return role === 'all' || role === 'worker';
}

/** HTTP API + websockets. */
export function shouldServeHttp(): boolean {
  const role = getProcessRole();
  return role === 'all' || role === 'api';
}

/** BullMQ workers. */
export function shouldRunQueueWorkers(): boolean {
  const role = getProcessRole();
  return role === 'all' || role === 'worker';
}

/** UDP collectors (SNMP/syslog/NetFlow) — single replica only. */
export function shouldRunCollectors(): boolean {
  const role = getProcessRole();
  return role === 'all' || role === 'collector';
}
