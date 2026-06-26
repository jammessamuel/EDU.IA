import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommercialPdfService } from './commercial-pdf.service';
import { SchoolConfigController } from './school-config.controller';
import { SchoolConfigService } from './school-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolConfigController],
  providers: [SchoolConfigService, CommercialPdfService],
  exports: [SchoolConfigService],
})
export class SchoolConfigModule {}
