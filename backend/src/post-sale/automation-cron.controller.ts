import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PostSaleService } from './post-sale.service';

@Controller('internal/automation')
export class AutomationCronController {
  constructor(private readonly postSale: PostSaleService) {}

  @Get('run')
  @Public()
  async run(
    @Headers('authorization') authorization?: string,
    @Headers('x-vercel-id') requestId?: string,
  ) {
    const secret = process.env.CRON_SECRET;
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Cron não autorizado.');
    }

    const startedAt = Date.now();
    const executionId = requestId || `manual-${startedAt}`;
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'daily_continuity.started',
        route: '/internal/automation/run',
        executionId,
      }),
    );

    try {
      const result = await this.postSale.runScheduledAutomation();
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'daily_continuity.completed',
          route: '/internal/automation/run',
          executionId,
          durationMs: Date.now() - startedAt,
          schoolsProcessed: result.schools.length,
          repairedCases: result.schools.reduce(
            (total, school) => total + Number(school.repairedCases ?? 0),
            0,
          ),
          createdTasks: result.schools.reduce(
            (total, school) => total + Number(school.createdTasks ?? 0),
            0,
          ),
          escalatedTasks: result.schools.reduce(
            (total, school) => total + Number(school.escalatedTasks ?? 0),
            0,
          ),
        }),
      );
      return result;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'daily_continuity.failed',
          route: '/internal/automation/run',
          executionId,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }
}
