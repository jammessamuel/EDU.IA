import { Module } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentChatService } from './enrollment-chat.service';
import { PaymentProvider } from './payment.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentChatService, PaymentProvider],
  exports: [EnrollmentService], // a IA (SimulatorService) pode reutilizar
})
export class EnrollmentModule {}
