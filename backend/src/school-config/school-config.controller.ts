import { Body, Controller, Get, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CommercialPdfService } from './commercial-pdf.service';
import { SchoolConfigService } from './school-config.service';

@Controller('school-config')
export class SchoolConfigController {
  constructor(
    private readonly service: SchoolConfigService,
    private readonly commercialPdf: CommercialPdfService,
  ) {}

  @Get('overview')
  @RequirePermission('leads:read:school')
  overview(@CurrentUser() user: { schoolId: string }) {
    return this.service.getConfig(user.schoolId);
  }

  @Put('profile')
  @RequirePermission('leads:update:school')
  updateProfile(@Body() body: Record<string, unknown>, @CurrentUser() user: { schoolId: string }) {
    return this.service.updateProfile(user.schoolId, body as any);
  }

  @Put('commercial')
  @RequirePermission('leads:update:school')
  updateCommercial(@Body() body: Record<string, unknown>, @CurrentUser() user: { schoolId: string }) {
    return this.service.updateCommercial(user.schoolId, body as any);
  }

  @Put('templates/:key')
  @RequirePermission('leads:update:school')
  updateTemplate(
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.service.updateTemplate(user.schoolId, key, body as any);
  }

  @Post('templates/:key/restore')
  @RequirePermission('leads:update:school')
  restoreTemplate(@Param('key') key: string, @CurrentUser() user: { schoolId: string }) {
    return this.service.restoreTemplate(user.schoolId, key);
  }

  @Post('templates/:key/preview')
  @RequirePermission('leads:read:school')
  previewTemplate(
    @Param('key') key: string,
    @Body() body: { variables?: Record<string, unknown> },
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.service.previewTemplate(user.schoolId, key, body.variables ?? {});
  }

  @Get('commercial-pdfs/:kind')
  @RequirePermission('leads:read:school')
  async commercialPdfDownload(
    @Param('kind') kind: string,
    @CurrentUser() user: { schoolId: string },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.commercialPdf.generate(user.schoolId, kind);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.end(buffer);
  }

  @Post('courses')
  @RequirePermission('leads:update:school')
  createCourse(@Body() body: Record<string, unknown>, @CurrentUser() user: { schoolId: string }) {
    return this.service.createCourse(user.schoolId, body);
  }

  @Put('courses/:id')
  @RequirePermission('leads:update:school')
  updateCourse(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.service.updateCourse(user.schoolId, id, body);
  }

  @Post('documents')
  @RequirePermission('leads:update:school')
  createDocument(@Body() body: Record<string, unknown>, @CurrentUser() user: { schoolId: string }) {
    return this.service.createDocument(user.schoolId, body);
  }

  @Put('documents/:id')
  @RequirePermission('leads:update:school')
  updateDocument(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.service.updateDocument(user.schoolId, id, body);
  }
}
