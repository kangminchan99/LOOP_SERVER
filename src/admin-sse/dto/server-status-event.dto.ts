import { ApiProperty } from '@nestjs/swagger';

class ServerMemoryStatusDto {
  @ApiProperty({
    example: 120,
    description: '프로세스가 OS에서 점유 중인 전체 메모리 MB',
  })
  rssMb!: number;

  @ApiProperty({
    example: 45,
    description: 'V8 Heap에서 실제 사용 중인 메모리 MB',
  })
  heapUsedMb!: number;

  @ApiProperty({
    example: 80,
    description: 'V8 Heap에 할당된 전체 메모리 MB',
  })
  heapTotalMb!: number;
}

export class ServerStatusEventDto {
  @ApiProperty({
    example: 'server_status',
    description: 'SSE 이벤트 타입',
  })
  type!: 'server_status';

  @ApiProperty({
    example: '2026-08-26T05:10:32.000Z',
    description: '서버 현재 시간',
  })
  serverTime!: string;

  @ApiProperty({
    example: 3600,
    description: '서버 프로세스 실행 시간, 초 단위',
  })
  uptimeSeconds!: number;

  @ApiProperty({
    type: ServerMemoryStatusDto,
    description: 'Node.js 프로세스 메모리 상태',
  })
  memory!: ServerMemoryStatusDto;
}
