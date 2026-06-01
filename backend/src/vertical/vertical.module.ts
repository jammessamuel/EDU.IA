import { Module } from '@nestjs/common';
import { VerticalService } from './vertical.service';
import { VerticalController } from './vertical.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VerticalController],
  providers: [VerticalService],
  exports: [VerticalService],
})
export class VerticalModule {}
