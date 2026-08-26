import { Injectable } from '@nestjs/common';
import { ServerStatusEventDto } from '../dto/server-status-event.dto';

@Injectable()
export class AdminSseService {
  getServerStatus(): ServerStatusEventDto {
    const memoryUsage = process.memoryUsage();

    return {
      type: 'server_status',
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: this.toMb(memoryUsage.rss),
        heapUsedMb: this.toMb(memoryUsage.heapUsed),
        heapTotalMb: this.toMb(memoryUsage.heapTotal),
      },
    };
  }

  private toMb(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }
}
