import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CouponEventResponseDto } from '../dto/coupon-event-response.dto';
import type { CreateCouponEventDto } from '../dto/create-coupon-event.dto';
import { UpdateCouponEventActivationDto } from '../dto/update-coupon-event-activation.dto';
import { CouponEventsRepository } from '../repositories/coupon-events.repository';

@Injectable()
export class CouponEventsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly couponEventsRepository: CouponEventsRepository,
  ) {}

  async create(
    adminUserId: number,
    dto: CreateCouponEventDto,
  ): Promise<CouponEventResponseDto> {
    // 1. 요청의 날짜 문자열을 Date로 변환한다.
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const couponExpiresAt = new Date(dto.couponExpiresAt);

    const dates = [startsAt, endsAt, couponExpiresAt];

    if (dates.some((date) => Number.isNaN(date.getTime()))) {
      throw new BadRequestException('올바른 날짜를 입력해주세요.');
    }

    // 2. 시작 < 종료 < 쿠폰 만료 순서를 검사한다.
    if (
      startsAt.getTime() >= endsAt.getTime() ||
      endsAt.getTime() >= couponExpiresAt.getTime()
    ) {
      throw new BadRequestException(
        '발급 시작 < 발급 종료 < 쿠폰 만료 순서여야 합니다.',
      );
    }

    // 3. 아래 DB 작업을 하나의 트랜잭션으로 실행한다.
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // 4. 계정을 잠그고 현재 관리자 권한을 확인한다.
      const admin = await this.couponEventsRepository.findUserForShare(
        manager,
        adminUserId,
      );

      if (!admin) {
        throw new UnauthorizedException('존재하지 않는 계정입니다.');
      }

      if (admin.role !== 'ADMIN') {
        throw new ForbiddenException('관리자만 이벤트를 생성할 수 있습니다.');
      }

      // 5. 기본 비활성 상태로 이벤트를 저장한다.
      const event = await this.couponEventsRepository.create(manager, {
        title: dto.title,
        totalQuantity: dto.totalQuantity,
        startsAt,
        endsAt,
        couponExpiresAt,
      });

      // 6. DB 시각과 함께 응답 데이터를 구성한다.
      const serverTime =
        await this.couponEventsRepository.getDatabaseNow(manager);

      return CouponEventResponseDto.fromEntity(event, serverTime);
    });
  }

  async updateActivation(
    adminUserId: number,
    eventId: number,
    dto: UpdateCouponEventActivationDto,
  ): Promise<CouponEventResponseDto> {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // 1. 관리자 계정을 먼저 잠그고 현재 권한을 확인한다.
      const admin = await this.couponEventsRepository.findUserForShare(
        manager,
        adminUserId,
      );

      if (!admin) {
        throw new UnauthorizedException('존재하지 않는 계정입니다.');
      }

      if (admin.role !== 'ADMIN') {
        throw new ForbiddenException(
          '관리자만 이벤트 상태를 변경할 수 있습니다.',
        );
      }

      // 2. 변경할 이벤트를 조회하고 잠근다.
      let event = await this.couponEventsRepository.findByIdForUpdate(
        manager,
        eventId,
      );

      if (!event) {
        throw new NotFoundException('쿠폰 이벤트를 찾을 수 없습니다.');
      }

      // 3. 이미 같은 상태라면 불필요한 UPDATE를 생략한다.
      if (event.isActive !== dto.isActive) {
        const updated = await this.couponEventsRepository.updateActivation(
          manager,
          eventId,
          dto.isActive,
        );

        if (!updated) {
          throw new InternalServerErrorException(
            '이벤트 상태를 변경하지 못했습니다.',
          );
        }

        // 4. DB에서 변경된 상태와 updatedAt을 다시 가져온다.
        event = await this.couponEventsRepository.findByIdForUpdate(
          manager,
          eventId,
        );

        if (!event) {
          throw new InternalServerErrorException(
            '변경된 이벤트를 조회하지 못했습니다.',
          );
        }
      }

      // 5. DB 시각을 포함한 응답을 구성한다.
      const serverTime =
        await this.couponEventsRepository.getDatabaseNow(manager);

      return CouponEventResponseDto.fromEntity(event, serverTime);
    });
  }
}
