import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePostDto } from '../../dto/create-dto';
import { Post } from '../../entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(authorId: number, dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      authorId,
    });
    return this.postsRepository.save(post);
  }
}
