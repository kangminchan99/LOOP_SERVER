import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  GetUserBlocksQueryDto,
  parseUserBlockCursor,
} from '../dto/get-user-blocks-query.dto';
import { UserBlockListItemDto } from '../dto/user-block-list-item.dto';
import { UserBlockListPageDto } from '../dto/user-block-list-page.dto';
import { UserBlockResponseDto } from '../dto/user-block-response.dto';
import { UserBlocksRepository } from '../repositories/user-blocks-repository';

@Injectable()
export class UserBlocksService {
  constructor(
    // 트랜잭션 시작과 EntityManager 제공
    private readonly dataSource: DataSource,

    // 차단 관계의 조회·저장·삭제
    private readonly blocksRepository: UserBlocksRepository,
  ) {}

  async block(
    blockerId: number,
    blockedUserId: number,
  ): Promise<UserBlockResponseDto> {
    // 1. 자기 자신 차단 방지
    if (blockerId === blockedUserId) {
      throw new BadRequestException('자기 자신은 차단할 수 없습니다.');
    }

    return this.runTransaction(async (manager) => {
      // 사용자 조회·관계 변경보다 먼저 잠근다.
      await this.blocksRepository.lockPair(manager, blockerId, blockedUserId);
      // 2. 로그인한 계정의 존재 확인·삭제 방지
      const blocker = await this.blocksRepository.findUserForKeyShare(
        manager,
        blockerId,
      );

      if (!blocker) {
        throw new UnauthorizedException('존재하지 않는 계정입니다.');
      }

      // 3. 차단 대상의 존재 확인·삭제 방지
      const target = await this.blocksRepository.findUserForKeyShare(
        manager,
        blockedUserId,
      );

      if (!target) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      // 4. 없으면 생성하고, 이미 있으면 유지
      await this.blocksRepository.insertIfAbsent(
        manager,
        blockerId,
        blockedUserId,
      );

      // 5. 실제 저장된 관계로 응답 구성
      const block = await this.blocksRepository.findByPair(
        manager,
        blockerId,
        blockedUserId,
      );

      if (!block) {
        throw new InternalServerErrorException(
          '차단 처리 결과를 확인할 수 없습니다.',
        );
      }

      return UserBlockResponseDto.fromEntity(block);
    });
  }

  async unblock(blockerId: number, blockedUserId: number): Promise<void> {
    await this.runTransaction(async (manager) => {
      // 사용자 조회·관계 변경보다 먼저 잠근다.
      await this.blocksRepository.lockPair(manager, blockerId, blockedUserId);
      // 1. 로그인한 계정 확인·삭제 방지
      const blocker = await this.blocksRepository.findUserForKeyShare(
        manager,
        blockerId,
      );

      if (!blocker) {
        throw new UnauthorizedException('존재하지 않는 계정입니다.');
      }

      // 2. 본인이 만든 차단 관계만 삭제
      await this.blocksRepository.deleteByPair(
        manager,
        blockerId,
        blockedUserId,
      );
    });
  }

  async findMyBlocks(
    blockerId: number,
    query: GetUserBlocksQueryDto,
  ): Promise<UserBlockListPageDto> {
    // 1. 요청받은 커서를 검증하고 날짜·ID로 변환
    const cursor = parseUserBlockCursor(query.cursor);

    return this.runTransaction(async (manager) => {
      // 2. 로그인한 계정 확인
      const blocker = await this.blocksRepository.findUserForKeyShare(
        manager,
        blockerId,
      );

      if (!blocker) {
        throw new UnauthorizedException('존재하지 않는 계정입니다.');
      }

      // 3. 다음 페이지 확인용으로 limit + 1개 조회
      const rows = await this.blocksRepository.findPage(
        manager,
        blockerId,
        query.limit,
        cursor,
      );

      const hasNext = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);

      // 4. 실제 반환하는 마지막 항목으로 다음 커서 생성
      return {
        items: items.map((block) => UserBlockListItemDto.fromEntity(block)),
        hasNext,
        nextCursor:
          hasNext && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
      };
    });
  }

  // 현재 트랜잭션에만 시간 제한을 적용한다.
  private async configureTransactionTimeouts(
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `
      SELECT
        set_config('lock_timeout', $1, true),
        set_config('statement_timeout', $2, true)
    `,
      ['1000ms', '3000ms'],
    );
  }

  private async runTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(
        'READ COMMITTED',
        async (manager) => {
          await this.configureTransactionTimeouts(manager);

          return work(manager);
        },
      );
    } catch (error: unknown) {
      // TypeORM이 감싼 실제 DB 오류를 확인한다.
      const driver: unknown =
        error instanceof QueryFailedError ? error.driverError : error;

      const code =
        typeof driver === 'object' &&
        driver !== null &&
        'code' in driver &&
        typeof driver.code === 'string'
          ? driver.code
          : undefined;

      if (code && ['55P03', '57014', '40P01', '40001'].includes(code)) {
        throw new ServiceUnavailableException({
          code: 'USER_BLOCKS_BUSY',
          message: '일시적으로 처리할 수 없습니다. 잠시 후 다시 시도해주세요.',
        });
      }

      // 인증·대상 없음 등 다른 오류는 그대로 전달한다.
      throw error;
    }
  }
}
