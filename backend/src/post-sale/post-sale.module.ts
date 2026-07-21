import { Module } from '@nestjs/common';
import { FakeContractService } from '../integrations/fake-contract.service';
import { FakeDocumentService } from '../integrations/fake-document.service';
import { FakePaymentService } from '../integrations/fake-payment.service';
import { FakeWhatsAppService } from '../integrations/fake-whatsapp.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SchoolConfigModule } from '../school-config/school-config.module';
import { PostSaleController } from './post-sale.controller';
import { PostSaleService } from './post-sale.service';
import { TaskAutomationService } from './task-automation.service';
import { AutomationCronController } from './automation-cron.controller';

@Module({
  imports: [PrismaModule, SchoolConfigModule],
  controllers: [PostSaleController, AutomationCronController],
  providers: [
    PostSaleService,
    TaskAutomationService,
    IntegrationLogService,
    FakeWhatsAppService,
    FakePaymentService,
    FakeContractService,
    FakeDocumentService,
  ],
})
export class PostSaleModule {}
