import { ReportsService } from './reports.service';

/**
 * Scheduled report execution. executeScheduledReports() finds due schedules,
 * generates each report, emails recipients with the rendered attachment, and
 * advances nextRunAt. We assert the email hand-off and schedule advancement
 * with a mocked EmailService + ReportGeneratorService.
 */
describe('ReportsService.executeScheduledReports', () => {
  function makeService(dueReports: any[]) {
    const prisma: any = {
      scheduledReport: {
        findMany: jest.fn().mockResolvedValue(dueReports),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reportGenerator: any = {
      generate: jest.fn().mockResolvedValue({ title: 'Asset Report', summary: { total: 10 } }),
      toCSV: jest.fn().mockReturnValue('col1,col2\n1,2'),
      toPDF: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      toXLSX: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
    };
    const emailService: any = { send: jest.fn().mockResolvedValue({}) };
    const service = new ReportsService(prisma, reportGenerator, emailService);
    return { service, prisma, reportGenerator, emailService };
  }

  const schedule = (overrides: any = {}) => ({
    id: 'sched-1',
    tenantId: 'tenant-1',
    name: 'Daily Assets',
    reportType: 'ASSET_INVENTORY',
    format: 'CSV',
    filters: {},
    recipients: ['ops@example.com'],
    schedule: '0 9 * * 1',
    ...overrides,
  });

  it('generates the report and emails recipients with a CSV attachment', async () => {
    const { service, reportGenerator, emailService, prisma } = makeService([schedule()]);

    await service.executeScheduledReports();

    expect(reportGenerator.generate).toHaveBeenCalledWith(
      'tenant-1',
      'ASSET_INVENTORY',
      expect.objectContaining({ format: 'CSV' }),
    );
    expect(reportGenerator.toCSV).toHaveBeenCalledTimes(1);

    expect(emailService.send).toHaveBeenCalledTimes(1);
    const mail = emailService.send.mock.calls[0][0];
    expect(mail.to).toEqual(['ops@example.com']);
    expect(mail.subject).toContain('Daily Assets');
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].filename).toMatch(/ASSET_INVENTORY_.*\.csv$/);
    expect(mail.attachments[0].contentType).toBe('text/csv');

    // nextRunAt advanced after successful execution
    const update = prisma.scheduledReport.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'sched-1' });
    expect(update.data.lastRunAt).toBeInstanceOf(Date);
    expect(update.data.nextRunAt).toBeInstanceOf(Date);
  });

  it('renders a PDF attachment when the schedule format is PDF', async () => {
    const { service, reportGenerator, emailService } = makeService([schedule({ format: 'PDF' })]);

    await service.executeScheduledReports();

    expect(reportGenerator.toPDF).toHaveBeenCalledTimes(1);
    expect(emailService.send.mock.calls[0][0].attachments[0].contentType).toBe('application/pdf');
  });

  it('skips email when there are no recipients but still advances the schedule', async () => {
    const { service, emailService, prisma } = makeService([schedule({ recipients: [] })]);

    await service.executeScheduledReports();

    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.scheduledReport.update).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no schedules are due', async () => {
    const { service, reportGenerator, emailService } = makeService([]);

    await service.executeScheduledReports();

    expect(reportGenerator.generate).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('continues past a failing schedule without throwing', async () => {
    const { service, reportGenerator, emailService, prisma } = makeService([
      schedule({ id: 'bad' }),
      schedule({ id: 'good' }),
    ]);
    reportGenerator.generate
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ title: 'ok', summary: {} });

    await expect(service.executeScheduledReports()).resolves.toBeUndefined();

    // only the good schedule emails + advances
    expect(emailService.send).toHaveBeenCalledTimes(1);
    expect(prisma.scheduledReport.update).toHaveBeenCalledTimes(1);
  });
});
