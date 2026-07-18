import { CronExpressionParser } from 'cron-parser';

/**
 * Next run from a standard 5-field (or 6-field with seconds) cron expression.
 * Falls back to +24h only when the expression cannot be parsed.
 */
export function calculateNextRun(cronExpr: string, from: Date = new Date()): Date {
  try {
    const expression = CronExpressionParser.parse(cronExpr, {
      currentDate: from,
      tz: 'UTC',
    });
    return expression.next().toDate();
  } catch {
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}
