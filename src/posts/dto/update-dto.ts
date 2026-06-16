import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
