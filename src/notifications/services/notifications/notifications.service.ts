import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterFcmTokenDto } from '../../dto/register-fcm-token.dto';
import { FcmToken } from '../../entities/fcm-token.entity';
import { DeleteFcmTokenDto } from '../../dto/delete-fcm-token.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(FcmToken)
    private readonly fcmTokensRepository: Repository<FcmToken>,
  ) {}

  async registerFcmToken(
    userId: number,
    dto: RegisterFcmTokenDto,
  ): Promise<void> {
    const existingToken = await this.fcmTokensRepository.findOne({
      where: { token: dto.token },
    });

    if (existingToken) {
      existingToken.userId = userId;
      existingToken.platform = dto.platform;
      existingToken.lastUsedAt = new Date();

      await this.fcmTokensRepository.save(existingToken);
      return;
    }

    const fcmToken = this.fcmTokensRepository.create({
      userId,
      token: dto.token,
      platform: dto.platform,
      lastUsedAt: new Date(),
    });

    await this.fcmTokensRepository.save(fcmToken);
  }

  async deleteFcmToken(userId: number, dto: DeleteFcmTokenDto): Promise<void> {
    await this.fcmTokensRepository.delete({
      userId,
      token: dto.token,
    });
  }
}
