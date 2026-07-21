import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { SimulatorService, ChatMessage } from './simulator.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('messages')
  @RequirePermission('leads:create:school')
  send(
    @Body()
    body: {
      text: string;
      history?: ChatMessage[];
      enrollmentDraft?: Record<string, any>;
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.chat(
      body.text,
      body.history ?? [],
      user.schoolId,
      user.id,
      body.enrollmentDraft ?? {},
    );
  }

  @Get('leads')
  @RequirePermission('leads:read:school')
  leads(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.simulatorService.getAllLeads(user.schoolId);
  }

  @Post('leads')
  @RequirePermission('leads:create:school')
  createLead(
    @Body()
    body: {
      name?: string;
      phone?: string | null;
      data?: Record<string, unknown>;
      status?: string;
      assigneeId?: string | null;
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.createLeadManually(
      user.schoolId,
      body,
      user.id,
    );
  }

  @Patch('leads/:id')
  @RequirePermission('leads:update:school')
  updateLead(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string | null;
      data?: Record<string, unknown>;
    },
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.simulatorService.updateLead(id, user.schoolId, body);
  }

  @Get('leads/:id/contacts')
  @RequirePermission('leads:read:school')
  leadContacts(
    @Param('id') id: string,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.simulatorService.getLeadContacts(id, user.schoolId);
  }

  @Get('metrics')
  @RequirePermission('leads:read:school')
  metrics(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.simulatorService.getMetrics(user.schoolId);
  }

  @Get('school/settings')
  @RequirePermission('leads:read:school')
  getSettings(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.simulatorService.getSchoolSettings(user.schoolId);
  }

  @Put('school/settings')
  @RequirePermission('leads:update:school')
  updateSettings(
    @Body()
    body: {
      name?: string;
      chatbotName?: string;
      courses?: string[];
      units?: string[];
    },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.updateSchoolSettings(user.schoolId, body);
  }

  @Get('leads/stale')
  @RequirePermission('leads:read:school')
  stale(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.simulatorService.getStaleLeds(user.schoolId);
  }

  @Patch('leads/:id/status')
  @RequirePermission('leads:update:school')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.updateLeadStatus(
      id,
      body.status,
      user.schoolId,
    );
  }

  @Patch('leads/:id/assignee')
  @RequirePermission('leads:update:school')
  updateAssignee(
    @Param('id') id: string,
    @Body() body: { assigneeId: string | null },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.updateLeadAssignee(
      id,
      body.assigneeId,
      user.schoolId,
    );
  }

  @Post('leads/:id/contacts')
  @RequirePermission('leads:create:school')
  registerLeadContact(
    @Param('id') id: string,
    @Body()
    body: {
      channel: string;
      outcome: string;
      note?: string;
      nextContactAt?: string | null;
    },
    @CurrentUser()
    user: { id: string; schoolId: string; name?: string },
  ) {
    return this.simulatorService.registerLeadContact(
      id,
      user.schoolId,
      body,
      user,
    );
  }
}
