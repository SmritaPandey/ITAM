import { NetflowCollectorService } from './netflow-collector.service';
import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';
import { SyslogReceiverService } from './syslog-receiver.service';

describe('UDP collector process-role gates', () => {
  const previousRole = process.env.PROCESS_ROLE;

  afterEach(() => {
    if (previousRole === undefined) delete process.env.PROCESS_ROLE;
    else process.env.PROCESS_ROLE = previousRole;
    jest.restoreAllMocks();
  });

  it('does not start UDP listeners in an API process', () => {
    process.env.PROCESS_ROLE = 'api';
    const prisma = {} as any;
    const eventBus = {} as any;
    const services = [
      new SnmpTrapReceiverService(prisma, eventBus),
      new SyslogReceiverService(prisma, eventBus),
      new NetflowCollectorService(prisma),
    ];
    const startSpies = services.map((service) => jest.spyOn(service, 'start'));

    services.forEach((service) => service.onModuleInit());

    startSpies.forEach((start) => expect(start).not.toHaveBeenCalled());
  });
});
