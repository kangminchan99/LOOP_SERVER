import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserBlockCursor } from '../types/user-block-cursor';

@Injectable()
export class UserBlocksRepository {
  // 특정 사용자 간의 차단 관계를 조회한다.
  findByPair(
    manager: EntityManager,
    blockerId: number,
    blockedUserId: number,
  ): Promise<UserBlock | null> {
    return manager.findOne(UserBlock, {
      where: {
        blockerId,
        blockedUserId,
      },
    });
  }

  findPage(
    manager: EntityManager,
    blockerId: number,
    limit: number,
    cursor?: UserBlockCursor,
  ): Promise<UserBlock[]> {
    const query = manager
      .createQueryBuilder(UserBlock, 'block')
      .innerJoin('block.blockedUser', 'blockedUser')
      // 응답과 커서에 필요한 필드만 조회한다.
      .select([
        'block.id',
        'block.blockerId',
        'block.blockedUserId',
        'block.createdAt',
        'blockedUser.id',
        'blockedUser.nickname',
        'blockedUser.profileImageUrl',
      ])
      .where('block.blockerId = :blockerId', { blockerId })
      .orderBy('block.createdAt', 'DESC')
      .addOrderBy('block.id', 'DESC')
      .take(limit + 1);

    // 이전 페이지의 마지막 항목보다 오래된 관계를 조회한다.
    if (cursor) {
      query.andWhere('(block.createdAt, block.id) < (:date, :id)', {
        date: cursor.date,
        id: cursor.id,
      });
    }

    return query.getMany();
  }

  async insertIfAbsent(
    manager: EntityManager,
    blockerId: number,
    blockedUserId: number,
  ): Promise<void> {
    await manager.query(
      `
      INSERT INTO "user_blocks" ("blockerId", "blockedUserId")
      VALUES ($1, $2)
      ON CONFLICT ON CONSTRAINT "UQ_user_blocks_blocker_target"
      DO NOTHING
    `,
      [blockerId, blockedUserId],
    );
  }

  // 본인이 만든 차단 관계만 삭제한다.
  async deleteByPair(
    manager: EntityManager,
    blockerId: number,
    blockedUserId: number,
  ): Promise<void> {
    await manager.delete(UserBlock, {
      blockerId,
      blockedUserId,
    });
  }

  // 트랜잭션 안에서 호출한다. 종료될 때까지 해당 계정 삭제를 대기시킨다.
  findUserForKeyShare(
    manager: EntityManager,
    userId: number,
  ): Promise<Pick<User, 'id'> | null> {
    return manager.findOne(User, {
      where: { id: userId },
      select: { id: true },
      lock: { mode: 'for_key_share' },
    });
  }

  // 같은 사용자 쌍의 작업을 트랜잭션 단위로 직렬화한다.
  async lockPair(
    manager: EntityManager,
    userId: number,
    targetUserId: number,
  ): Promise<void> {
    const firstId = Math.min(userId, targetUserId);
    const secondId = Math.max(userId, targetUserId);

    await manager.query(
      'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
      [firstId, secondId],
    );
  }
}
