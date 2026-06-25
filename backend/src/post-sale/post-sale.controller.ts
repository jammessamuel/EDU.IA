import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostSaleService } from './post-sale.service';

@Controller('post-sales')
export class PostSaleController {
  constructor(private readonly service: PostSaleService) {}

  @Get('overview')
  @RequirePermission('leads:read:school')
  overview(@CurrentUser() user: { schoolId: string }): Promise<unknown> {
    return this.service.overview(user.schoolId);
  }

  @Patch('students/:studentKey/status')
  @RequirePermission('leads:create:school')
  updateStatus(
    @Param('studentKey') studentKey: string,
    @Body() body: { action?: string; note?: string },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.updateStudentStatus(user.schoolId, studentKey, body);
  }

  @Post('students/:studentKey/tasks')
  @RequirePermission('leads:create:school')
  createTask(
    @Param('studentKey') studentKey: string,
    @Body() body: { title?: string; ownerTeam?: string; priority?: string; dueInDays?: number },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.createTask(user.schoolId, studentKey, body);
  }

  @Post('students/:studentKey/messages/simulate')
  @RequirePermission('leads:create:school')
  simulateMessage(
    @Param('studentKey') studentKey: string,
    @Body() body: { message?: string },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.simulateMessage(user.schoolId, studentKey, body);
  }
}
