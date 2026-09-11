import {
  buildHealthcareSearchKey,
  getHealthcareSearchTerms,
  normalizeHealthcareDisplayText,
  normalizeHealthcareEmail,
  normalizeHealthcareOptionalText,
  normalizeHealthcareSearchText,
} from './healthcare-normalization';

describe('Healthcare normalization', () => {
  it.each([
    ['José', 'Jose'],
    ['Muñoz', 'Munoz'],
    ['HERMOSILLO', 'hermosillo'],
    ['  Juan   Pérez  ', 'juan perez'],
    ['Mérida Yucatán', 'merida yucatan'],
  ])('normalizes %j equivalently to %j', (left, right) => {
    expect(normalizeHealthcareSearchText(left)).toBe(
      normalizeHealthcareSearchText(right),
    );
  });

  it('keeps display accents while trimming and collapsing whitespace', () => {
    expect(normalizeHealthcareDisplayText('  José   Muñoz  ')).toBe(
      'José Muñoz',
    );
  });

  it('uses a stable non-ambiguous separator in composite search keys', () => {
    expect(buildHealthcareSearchKey([' José ', 'Muñoz', ' CARDIOLOGÍA '])).toBe(
      'jose\u001Fmunoz\u001Fcardiologia',
    );
  });

  it.each([
    ['  José  ', 'jose'],
    ['José Pérez', 'jose perez'],
    ['José\u001FPérez', 'jose perez'],
    ['  José   Pérez  ', 'jose perez'],
    ['José\u001F\u001FPérez', 'jose perez'],
  ])('normalizes search input %j to %j', (input, expected) => {
    expect(normalizeHealthcareSearchText(input)).toBe(expected);
  });

  it.each(['\u0301', '\u001F', ' \u001F '])(
    'normalizes non-searchable input %j to an empty string',
    (input) => {
      expect(normalizeHealthcareSearchText(input)).toBe('');
      expect(getHealthcareSearchTerms(input)).toEqual([]);
    },
  );

  it.each([
    ['José Pérez', ['jose', 'perez']],
    ['José\u001FPérez', ['jose', 'perez']],
    ['  José   Pérez  ', ['jose', 'perez']],
    ['José\u001F\u001FPérez', ['jose', 'perez']],
  ])('builds non-empty search terms for %j', (input, expected) => {
    const terms = getHealthcareSearchTerms(input);

    expect(terms).toEqual(expected);
    expect(terms).not.toContain('');
  });

  it('converts optional blank text to null and preserves omission', () => {
    expect(normalizeHealthcareOptionalText('   ')).toBeNull();
    expect(normalizeHealthcareOptionalText(null)).toBeNull();
    expect(normalizeHealthcareOptionalText(undefined)).toBeUndefined();
  });

  it('trims and lowercases email without changing omission/null', () => {
    expect(normalizeHealthcareEmail('  MEDICO@EXAMPLE.COM ')).toBe(
      'medico@example.com',
    );
    expect(normalizeHealthcareEmail(null)).toBeNull();
    expect(normalizeHealthcareEmail(undefined)).toBeUndefined();
  });
});
