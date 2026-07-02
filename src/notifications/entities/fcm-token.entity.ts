import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

@Entity('fcm_tokens')
@Unique(['token'])
@Index(['userId'])
export class FcmToken {
  @PrimaryGeneratedColumn()
  id!: number;

  // 어떤 유저의 기기 토큰인지 저장한다.
  @Column()
  userId!: number;

  // Flutter 앱에서 FirebaseMessaging.getToken()으로 받은 FCM 토큰.
  // 한 기기를 식별하는 푸시 발송 주소라고 보면 된다.
  @Column({ type: 'varchar', length: 512 })
  token!: string;

  // 토큰이 Android 기기에서 온 건지 iOS 기기에서 온 건지 구분한다.
  @Column({ type: 'varchar', length: 20 })
  platform!: DevicePlatform;

  // 같은 유저가 여러 기기로 로그인할 수 있으므로 User와 N:1 관계다.
  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  user!: User;

  // 토큰이 마지막으로 확인/등록된 시간.
  // 앱 실행 시 토큰을 다시 등록하면 이 시간이 갱신된다.
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
