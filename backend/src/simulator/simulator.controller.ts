import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SimulatorService, ChatMessage } from './simulator.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('messages')
  @RequirePermission('leads:create:school')
  send(
    @Body() body: { text: string; history?: ChatMessage[] },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    // Histórico vem do cliente (serverless-friendly: sem estado no servidor).
    return this.simulatorService.chat(body.text, body.history ?? [], user.schoolId);
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
