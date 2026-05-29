import { Body, Controller, Delete, Get, Param, Patch, Post, Session } from '@nestjs/common';
import { SimulatorService, ChatMessage } from './simulator.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('messages')
  @RequirePermission('leads:create:school')
  send(
    @Body() body: { text: string },
    @Session() session: Record<string, any>,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    if (!session.messages) session.messages = [];
    return this.simulatorService.chat(body.text, session.messages as ChatMessage[], user.schoolId);
  }

  @Delete('session')
  @RequirePermission('leads:create:school')
  reset(@Session() session: Record<string, any>) {
    session.messages = [];
    return { ok: true };
  }

  @Get('leads')
  @RequirePermission('leads:read:school')
  leads(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.simulatorService.getAllLeads(user.schoolId);
  }

  @Patch('leads/:id/status')
  @RequirePermission('leads:update:school')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.simulatorService.updateLeadStatus(id, body.status, user.schoolId);
  }
}
