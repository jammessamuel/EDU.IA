import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessibilityController } from './accessibility.controller';
import { AccessibilityService } from './accessibility.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccessibilityController],
  providers: [AccessibilityService],
  exports: [AccessibilityService],
})
export class AccessibilityModule {}
