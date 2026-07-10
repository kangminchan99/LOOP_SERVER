import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { User } from '../../users/entities/user.entity';

config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
});

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User, Post],
  synchronize: false,
});

const USER_COUNT = 1000;
const POST_COUNT = 10000;
const BATCH_SIZE = 1000;

function createSeedUsers() {
  return Array.from({ length: USER_COUNT }, (_, index) => {
    const number = index + 1;

    return {
      email: `seed-user-${number}@loop.dev`,
      password: null,
      nickname: `시드유저${number}`,
      profileImageUrl: null,
      point: 0,
    };
  });
}

function createSeedPosts(userIds: number[]) {
  return Array.from({ length: POST_COUNT }, (_, index) => {
    const number = index + 1;
    const authorId = userIds[index % userIds.length];

    return {
      title: `대용량 테스트 게시글 ${number}`,
      content: `이 게시글은 대용량 데이터 처리 테스트를 위해 생성된 ${number}번째 게시글입니다.`,
      authorId,
    };
  });
}

async function insertInBatches<T extends object>(
  repository: { insert: (items: T[]) => Promise<unknown> },
  items: T[],
  batchSize: number,
  label: string,
) {
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);

    await repository.insert(batch);

    console.log(
      `${label}: ${Math.min(start + batchSize, items.length)}/${items.length}`,
    );
  }
}

async function main() {
  await AppDataSource.initialize();

  console.log('DB 연결 성공');

  const userRepository = AppDataSource.getRepository(User);
  const postRepository = AppDataSource.getRepository(Post);

  console.log('기존 seed 게시글 삭제 중...');
  await postRepository
    .createQueryBuilder()
    .delete()
    .from(Post)
    .where('title LIKE :title', { title: '대용량 테스트 게시글%' })
    .execute();

  console.log('기존 seed 유저 삭제 중...');
  await userRepository
    .createQueryBuilder()
    .delete()
    .from(User)
    .where('email LIKE :email', { email: 'seed-user-%@loop.dev' })
    .execute();

  console.time('seed');

  const users = createSeedUsers();

  await insertInBatches(userRepository, users, BATCH_SIZE, 'users');

  const seedUsers = await userRepository.find({
    select: {
      id: true,
    },
    where: users.map((user) => ({
      email: user.email,
    })),
  });

  const userIds = seedUsers.map((user) => user.id);

  const posts = createSeedPosts(userIds);

  await insertInBatches(postRepository, posts, BATCH_SIZE, 'posts');

  console.timeEnd('seed');

  await AppDataSource.destroy();

  console.log('DB 연결 종료');
}

main().catch(async (error) => {
  console.error('Seed 실패:', error);

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(1);
});
