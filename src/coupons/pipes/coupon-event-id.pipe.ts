import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';

@Injectable()
export class CouponEventIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2147483647)
      throw new BadRequestException('잘못된 이벤트 ID입니다.');
    return Number(value);
  }
}
