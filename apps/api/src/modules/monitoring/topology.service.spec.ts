import { LLDP_CDP_OIDS, parseNeighborOidMap } from './topology.service';

describe('parseNeighborOidMap', () => {
  it('joins LLDP table columns into one normalized neighbor', () => {
    const suffix = '0.12.1';
    const result = parseNeighborOidMap(
      {
        [`${LLDP_CDP_OIDS.lldpRemoteChassisId}.${suffix}`]: Buffer.from('001122334455', 'hex'),
        [`${LLDP_CDP_OIDS.lldpRemotePortId}.${suffix}`]: 'Gi0/24',
        [`${LLDP_CDP_OIDS.lldpRemoteSystemName}.${suffix}`]: 'core-switch-01',
      },
      'lldp',
    );

    expect(result).toEqual([
      expect.objectContaining({
        localPortIndex: 12,
        remoteChassisId: '001122334455',
        remotePortName: 'Gi0/24',
        remoteSysName: 'core-switch-01',
      }),
    ]);
  });

  it('decodes a CDP management address', () => {
    const suffix = '7.1';
    const result = parseNeighborOidMap(
      {
        [`${LLDP_CDP_OIDS.cdpRemoteAddress}.${suffix}`]: Buffer.from([10, 20, 30, 40]),
        [`${LLDP_CDP_OIDS.cdpRemoteDeviceId}.${suffix}`]: 'access-switch-07',
      },
      'cdp',
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        localPortIndex: 7,
        remoteIp: '10.20.30.40',
        remoteChassisId: 'access-switch-07',
      }),
    );
  });
});
