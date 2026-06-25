import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolConfigController } from './school-config.controller';
import { SchoolConfigService } from './school-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolConfigController],
  providers: [SchoolConfigService],
  exports: [SchoolConfigService],
})
export class SchoolConfigModule {}
