import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';
import { VerticalModule } from '../vertical/vertical.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { SchoolConfigModule } from '../school-config/school-config.module';

@Module({
  imports: [PrismaModule, VerticalModule, EnrollmentModule, SchoolConfigModule],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}
