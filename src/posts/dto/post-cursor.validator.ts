import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'postCursor', async: false })
export class PostCursorValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    // 서버가 발급하는 ISO 시간_ID 형식만 허용한다.
    const match =
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_([1-9]\d*)$/.exec(value);
    if (!match) return false;
    const date = new Date(match[1]);
    const id = Number(match[2]);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString() === match[1] &&
      Number.isInteger(id) &&
      id <= 2147483647
    );
  }

  defaultMessage(): string {
    return 'cursor must be a valid ISO timestamp and positive PostgreSQL integer ID (createdAt_postId)';
  }
}
