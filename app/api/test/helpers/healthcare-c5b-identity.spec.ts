import {
  c5bConnectionUrl,
  c5bValidateIdentity,
} from './healthcare-c5b-harness';

const connected = {
  database: 'zaping_spike_test',
  user: 'zaping_hc_c5b',
  sessionUser: 'zaping_hc_c5b',
  schema: 'public',
  address: '172.17.0.2/32',
  port: 5432,
  version: '160015',
  pid: 123,
};
const url =
  'postgresql://zaping_hc_c5b:synthetic-password@127.0.0.1:5434/zaping_spike_test';

describe('C5B external endpoint and connected identity (no database)', () => {
  it('accepts the strict external endpoint independently of the internal address', () => {
    const validated = new URL(c5bConnectionUrl(url));
    expect(validated.hostname).toBe('127.0.0.1');
    expect(validated.port).toBe('5434');
    expect(c5bValidateIdentity([connected])).toEqual(connected);
  });

  it.each([
    url.replace('127.0.0.1', '172.17.0.2'),
    url.replace('127.0.0.1', 'localhost'),
    url.replace('5434', '5432'),
    url.replace('postgresql:', 'https:'),
    url.replace('zaping_hc_c5b', 'other_role'),
    url.replace('zaping_spike_test', 'other_database'),
    url.replace('synthetic-password', ''),
    `${url}?schema=public`,
    `${url}#override`,
  ])('rejects external URL contract mismatch %#', (value) => {
    expect(() => c5bConnectionUrl(value)).toThrow('C5B invalid dedicated URL');
  });

  it.each([
    '172.17.0.2/32',
    '10.42.7.9/32',
    '192.168.25.4',
    'fd00:abcd::2/128',
    '::1',
  ])(
    'accepts valid server address %# without hardcoding a Docker IP',
    (address) => {
      const value = { ...connected, address };
      expect(c5bValidateIdentity([value])).toBe(value);
    },
  );

  it.each([
    null,
    '',
    ' ',
    'not-an-ip',
    '172.17.0.999/32',
    '172.17.0.2/',
    '172.17.0.2/33',
    '172.17.0.2/-1',
    '172.17.0.2/32/1',
    '172.17.0.2/32junk',
    'fd00::2/129',
    'fe80::1%eth0',
    '172.17.0.2/32\n',
  ])('rejects absent or malformed server address %#', (address) => {
    expect(() => c5bValidateIdentity([{ ...connected, address }])).toThrow(
      'C5B connected identity mismatch',
    );
  });

  it.each([
    { database: 'other_database' },
    { user: 'other_role' },
    { sessionUser: 'other_role' },
    { schema: 'other_schema' },
    { port: 5434 },
    { version: '150015' },
    { version: '170001' },
    { pid: 0 },
    { pid: -1 },
    { pid: 1.5 },
  ])('keeps remaining identity checks strict %#', (patch) => {
    expect(() => c5bValidateIdentity([{ ...connected, ...patch }])).toThrow(
      'C5B connected identity mismatch',
    );
  });

  it('requires exactly one identity row', () => {
    expect(() => c5bValidateIdentity([])).toThrow(
      'C5B connected identity mismatch',
    );
    expect(() => c5bValidateIdentity([connected, connected])).toThrow(
      'C5B connected identity mismatch',
    );
  });
});
