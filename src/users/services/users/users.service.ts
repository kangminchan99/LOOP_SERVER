import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable() // Nest DI 컨테이너에 서비스로 등록
export class UsersService {
  constructor(
    @InjectRepository(User) // User 엔티티용 TypeORM Repository 주입
    private readonly usersRepository: Repository<User>,
  ) {}

  // 전체 유저 목록 조회 (id 내림차순: 최신 생성 유저 먼저)
  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { id: 'DESC' },
    });
  }

  // id로 유저 1명 조회
  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    // 조회 결과가 없으면 404 예외 발생
    if (!user) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }

    return user;
  }

  // 유저 생성
  async create(
    email: string,
    password: string,
    nickname: string,
  ): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 해시 (평문 저장 금지)
    const hashedPassword = await bcrypt.hash(password, 10);

    // create: 메모리 상 엔티티 객체 생성 (DB 저장 X)
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      nickname,
    });

    // save: 실제 DB insert 실행
    return this.usersRepository.save(user);
  }

  // 유저 삭제
  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);

    // 삭제된 row가 0개면 존재하지 않는 유저
    if (result.affected === 0) {
      throw new NotFoundException('유저를 찾을 수 없습니다.');
    }
  }

  // 프로필 이미지 URL 갱신
  async updateProfileImage(
    userId: number,
    profileImageUrl: string,
  ): Promise<User> {
    const user = await this.findOne(userId);
    user.profileImageUrl = profileImageUrl;
    return this.usersRepository.save(user);
  }
}
