import { Module } from '@nestjs/common';
import { FakeContractService } from '../integrations/fake-contract.service';
import { FakeDocumentService } from '../integrations/fake-document.service';
import { FakePaymentService } from '../integrations/fake-payment.service';
import { FakeWhatsAppService } from '../integrations/fake-whatsapp.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PostSaleController } from './post-sale.controller';
import { PostSaleService } from './post-sale.service';

@Module({
  imports: [PrismaModule],
  controllers: [PostSaleController],
  providers: [
    PostSaleService,
    IntegrationLogService,
    FakeWhatsAppService,
    FakePaymentService,
    FakeContractService,
    FakeDocumentService,
  ],
})
export class PostSaleModule {}
