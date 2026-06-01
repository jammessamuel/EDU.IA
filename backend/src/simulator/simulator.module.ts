import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { VerticalModule } from '../vertical/vertical.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, VerticalModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}
