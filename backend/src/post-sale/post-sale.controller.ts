import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostSaleService } from './post-sale.service';

@Controller('post-sales')
export class PostSaleController {
  constructor(private readonly service: PostSaleService) {}

  @Get('overview')
  @RequirePermission('leads:read:school')
  overview(
    @CurrentUser() user: { schoolId: string },
    @Query('includeDemo') includeDemo?: string,
  ): Promise<unknown> {
    return this.service.overview(user.schoolId, includeDemo === 'true');
  }

  @Get('integration-logs')
  @RequirePermission('leads:read:school')
  integrationLogs(@CurrentUser() user: { schoolId: string }): Promise<unknown> {
    return this.service.listIntegrationLogs(user.schoolId);
  }

  @Get('today')
  @RequirePermission('leads:read:school')
  today(
    @CurrentUser() user: { id: string; schoolId: string },
    @Query('onlyMine') onlyMine?: string,
  ): Promise<unknown> {
    return this.service.today(
      user.schoolId,
      onlyMine === 'true' ? user.id : undefined,
    );
  }

  @Get('students/:studentKey/profile')
  @RequirePermission('leads:read:school')
  studentProfile(
    @Param('studentKey') studentKey: string,
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.studentProfile(user.schoolId, studentKey);
  }

  @Post('students/:studentKey/contacts')
  @RequirePermission('leads:create:school')
  registerContact(
    @Param('studentKey') studentKey: string,
    @Body()
    body: {
      channel: string;
      outcome: string;
      note?: string;
      nextContactAt?: string | null;
    },
    @CurrentUser()
    user: { id: string; schoolId: string; name?: string },
  ): Promise<unknown> {
    return this.service.registerContact(user.schoolId, studentKey, body, user);
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

  @Patch('students/:studentKey/assignee')
  @RequirePermission('leads:create:school')
  assignStudent(
    @Param('studentKey') studentKey: string,
    @Body() body: { assigneeId: string | null },
    @CurrentUser() user: { id: string; schoolId: string; name?: string },
  ): Promise<unknown> {
    return this.service.assignStudent(
      user.schoolId,
      studentKey,
      body.assigneeId,
      user,
    );
  }

  @Patch('students/:studentKey/lifecycle')
  @RequirePermission('leads:create:school')
  updateLifecycle(
    @Param('studentKey') studentKey: string,
    @Body()
    body: {
      status: 'ATIVO' | 'PAUSADO' | 'ENCERRADO';
      reason?: string;
      nextActionAt?: string | null;
    },
    @CurrentUser() user: { id: string; schoolId: string; name?: string },
  ): Promise<unknown> {
    return this.service.updateLifecycle(user.schoolId, studentKey, body, user);
  }

  @Post('students/:studentKey/tasks')
  @RequirePermission('leads:create:school')
  createTask(
    @Param('studentKey') studentKey: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      ownerTeam?: string;
      assignee?: string;
      assigneeId?: string | null;
      role?: string;
      priority?: string;
      dueInDays?: number;
      dueAt?: string;
      column?: string;
      origin?: string;
      reminderDaysBefore?: number | null;
      recurrenceIntervalDays?: number | null;
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ): Promise<unknown> {
    return this.service.createTask(
      user.schoolId,
      { ...body, studentKey },
      user,
    );
  }

  @Post('tasks')
  @RequirePermission('leads:create:school')
  createManualTask(
    @Body()
    body: {
      title?: string;
      description?: string;
      studentKey?: string | null;
      studentName?: string;
      ownerTeam?: string;
      assignee?: string;
      assigneeId?: string | null;
      role?: string;
      priority?: string;
      dueAt?: string;
      column?: string;
      origin?: string;
      reminderDaysBefore?: number | null;
      recurrenceIntervalDays?: number | null;
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ): Promise<unknown> {
    return this.service.createTask(user.schoolId, body, user);
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
      assigneeId?: string | null;
      role?: string;
      priority?: string;
      title?: string;
      description?: string;
      dueAt?: string | null;
      recurrenceIntervalDays?: number | null;
      action?: 'CANCEL' | 'REOPEN';
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ): Promise<unknown> {
    return this.service.updateTask(user.schoolId, taskId, body, user);
  }

  @Post('tasks/:taskId/alert/dispatch')
  @RequirePermission('leads:create:school')
  dispatchTaskAlert(
    @Param('taskId') taskId: string,
    @CurrentUser() user: { schoolId: string },
  ): Promise<unknown> {
    return this.service.dispatchTaskAlert(user.schoolId, taskId);
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

  @Patch('students/:studentKey/operations/payment')
  @RequirePermission('leads:create:school')
  updateOperationalPayment(
    @Param('studentKey') studentKey: string,
    @Body() body: { status?: string; note?: string },
    @CurrentUser() user: { id: string; schoolId: string; name?: string },
  ): Promise<unknown> {
    return this.service.updateOperationalPayment(
      user.schoolId,
      studentKey,
      body,
      user,
    );
  }

  @Patch('students/:studentKey/operations/contract')
  @RequirePermission('leads:create:school')
  updateOperationalContract(
    @Param('studentKey') studentKey: string,
    @Body() body: { status?: string; note?: string },
    @CurrentUser() user: { id: string; schoolId: string; name?: string },
  ): Promise<unknown> {
    return this.service.updateOperationalContract(
      user.schoolId,
      studentKey,
      body,
      user,
    );
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
