import { formatPhoneDisplay, last10, maskPhone, toE164 } from '../phone';

describe('toE164', () => {
  it.each([
    ['9135550101', '+19135550101'],
    ['(913) 555-0101', '+19135550101'],
    ['913.555.0101', '+19135550101'],
    ['1-913-555-0101', '+19135550101'],
    ['+1 913 555 0101', '+19135550101'],
    ['  +19135550101 ', '+19135550101'],
    ['+447911123456', '+447911123456'],
  ])('%p -> %p', (raw, expected) => expect(toE164(raw)).toBe(expected));

  it.each([
    [''],
    ['   '],
    ['555-0101'],
    ['call me'],
    ['913555010'],
    ['91355501012'],
    ['0135550101'], // area code can't start with 0
    ['9131550101'], // exchange can't start with 1
    ['+1913555010'],
    ['+0123456789'],
    ['913-555-0101 ext 4'],
  ])('rejects %p', (raw) => expect(toE164(raw)).toBeNull());

  it('handles null/undefined', () => {
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });
});

describe('last10 / mask / display', () => {
  it('last10', () => {
    expect(last10('+1 (913) 555-0101')).toBe('9135550101');
    expect(last10('555-0101')).toBeNull();
    expect(last10(null)).toBeNull();
  });
  it('mask shows only the last 4', () => {
    expect(maskPhone('+19135550101')).toBe('•••-0101');
    expect(maskPhone('')).toBe('••••');
  });
  it('display', () => {
    expect(formatPhoneDisplay('+19135550101')).toBe('(913) 555-0101');
  });
});
