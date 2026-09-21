import { PostCursorValidator } from './post-cursor.validator';

describe('PostCursorValidator', () => {
  const validator = new PostCursorValidator();

  it.each([
    '2026-09-21T12:00:00.123Z_1',
    '2024-02-29T00:00:00.000Z_2147483647',
  ])('서버가 생성하는 유효한 커서 %s 허용', (cursor) => {
    expect(validator.validate(cursor)).toBe(true);
  });

  it.each([
    undefined,
    null,
    123,
    {},
    [],
    '',
    'invalid',
    '2026-02-30T12:00:00.000Z_1',
    '2026-13-01T12:00:00.000Z_1',
    '2026-09-21T12:00:00.000Z_0',
    '2026-09-21T12:00:00.000Z_-1',
    '2026-09-21T12:00:00.000Z_1.5',
    '2026-09-21T12:00:00.000Z_2147483648',
    '2026-09-21T12:00:00.000Z_1_extra',
  ])('잘못된 커서 %p 거부', (cursor) => {
    expect(validator.validate(cursor)).toBe(false);
  });
});
