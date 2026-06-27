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

  @Get('integration-logs')
  @RequirePermission('leads:read:school')
  integrationLogs(@CurrentUser() user: { schoolId: string }): Promise<unknown> {
    return this.service.listIntegrationLogs(user.schoolId);
  }

  @Get('students/:studentKey/profile')
  @RequirePermission('leads:read:school')
  studentProfile(
    @Param('studentKey') studentKey: string,
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.studentProfile(user.schoolId, studentKey);
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
    @Body()
    body: {
      title?: string;
      ownerTeam?: string;
      priority?: string;
      dueInDays?: number;
    },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.createTask(user.schoolId, studentKey, body);
  }

  @Patch('tasks/:taskId')
  @RequirePermission('leads:create:school')
  updateTask(
    @Param('taskId') taskId: string,
    @Body()
    body: {
      column?: string;
      status?: string;
      assignee?: string;
      role?: string;
      priority?: string;
    },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.updateTask(user.schoolId, taskId, body);
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

  @Post('students/:studentKey/ruler/simulate')
  @RequirePermission('leads:create:school')
  simulateRuler(
    @Param('studentKey') studentKey: string,
    @Body() body: { dayOffset?: number | null },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.simulateRuler(user.schoolId, studentKey, body);
  }

  @Post('students/:studentKey/fake/payment')
  @RequirePermission('leads:create:school')
  simulatePayment(
    @Param('studentKey') studentKey: string,
    @Body() body: { action?: any; amount?: number },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.simulatePayment(user.schoolId, studentKey, body);
  }

  @Post('students/:studentKey/fake/contract')
  @RequirePermission('leads:create:school')
  simulateContract(
    @Param('studentKey') studentKey: string,
    @Body() body: { action?: any },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.simulateContract(user.schoolId, studentKey, body);
  }

  @Post('students/:studentKey/fake/document')
  @RequirePermission('leads:create:school')
  simulateDocument(
    @Param('studentKey') studentKey: string,
    @Body()
    body: {
      action?: any;
      documentType?: string;
      reason?: string;
      fileName?: string;
    },
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.simulateDocument(user.schoolId, studentKey, body);
  }
}
