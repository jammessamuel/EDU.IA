import { Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentChatService, type ChatMessage } from './enrollment-chat.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { DOCUMENT_REQUIREMENTS, EDUCATION_ENROLLMENT_FIELDS, SECTION_LABELS } from './enrollment-fields';

@Controller('enrollments')
export class EnrollmentController {
  constructor(
    private readonly service: EnrollmentService,
    private readonly chatService: EnrollmentChatService,
  ) {}

  // Campos do formulário de matrícula — o frontend e a IA usam pra saber o que coletar.
  @Get('fields')
  @RequirePermission('leads:read:school')
  fields() {
    return { sections: SECTION_LABELS, fields: EDUCATION_ENROLLMENT_FIELDS, documentRequirements: DOCUMENT_REQUIREMENTS };
  }

  @Get('verify/:authCode')
  @Public()
  verify(@Param('authCode') authCode: string) {
    return this.service.verifyByAuthCode(authCode);
  }

  // Conversa de matrícula com a IA (function calling). Stateless: manda
  // history + draft, recebe a resposta + draft atualizado + matrícula (se efetivada).
  @Post('chat')
  @RequirePermission('leads:create:school')
  chat(
    @Body() body: { text: string; history?: ChatMessage[]; draft?: Record<string, any> },
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.chatService.chat(body.text, body.history ?? [], body.draft ?? {}, user.schoolId);
  }

  // Efetiva a matrícula direto (sem IA). Aceita { data: {...campos} } ou os campos no corpo.
  @Post()
  @RequirePermission('leads:create:school')
  enroll(
    @Body() body: { data?: Record<string, any>; leadId?: string } & Record<string, any>,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    const data = body.data ?? body;
    return this.service.enroll(user.schoolId, data, { leadId: body.leadId });
  }

  @Get()
  @RequirePermission('leads:read:school')
  list(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.service.findAll(user.schoolId);
  }

  @Get(':id')
  @RequirePermission('leads:read:school')
  detail(@Param('id') id: string, @CurrentUser() user: { id: string; schoolId: string }) {
    return this.service.findOne(id, user.schoolId);
  }

  @Get(':id/documents')
  @RequirePermission('leads:read:school')
  documents(@Param('id') id: string, @CurrentUser() user: { id: string; schoolId: string }) {
    return this.service.documents(id, user.schoolId);
  }

  @Post(':id/documents')
  @RequirePermission('leads:create:school')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  uploadDocument(
    @Param('id') id: string,
    @Body('type') type: string,
    @UploadedFile() file: any,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.service.attachDocument(id, user.schoolId, {
      type: type || 'OUTRO',
      fileName: file?.originalname,
      mimeType: file?.mimetype,
      size: file?.size,
      buffer: file?.buffer,
    });
  }

  @Get(':id/documents/:documentId')
  @RequirePermission('leads:read:school')
  async downloadDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string; schoolId: string },
    @Res() res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.service.documentFile(id, documentId, user.schoolId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }

  // Comprovante em PDF. O frontend baixa via fetch+blob (precisa do header de auth).
  @Get(':id/comprovante.pdf')
  @RequirePermission('leads:read:school')
  async comprovante(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; schoolId: string },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.comprovante(id, user.schoolId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }
}
