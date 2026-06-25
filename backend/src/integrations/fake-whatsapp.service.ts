import { Injectable } from '@nestjs/common';
import { FakeIntegrationContext, IntegrationLogDto } from './fake-services.types';
import { IntegrationLogService } from './integration-log.service';

export interface MessagingService {
  sendMessage(input: { context: FakeIntegrationContext; message: string }): Promise<{
    providerMessageId: string;
    status: 'ENVIADO';
    message: string;
    log: IntegrationLogDto;
  }>;
}

@Injectable()
export class FakeWhatsAppService implements MessagingService {
  constructor(private logs: IntegrationLogService) {}

  async sendMessage(input: { context: FakeIntegrationContext; message: string }) {
    const providerMessageId = `fake-wa-${Date.now()}`;
    const responsePayload = {
      providerMessageId,
      status: 'ENVIADO',
      deliveryState: 'entregue_em_ambiente_de_teste',
    };

    const log = await this.logs.record({
      context: input.context,
      service: 'WHATSAPP',
      action: 'SEND_MESSAGE',
      status: 'ENVIADO',
      requestPayload: {
        to: input.context.studentName,
        channel: 'WhatsApp',
        message: input.message,
      },
      responsePayload,
      visibleMessage: `Mensagem registrada no WhatsApp fake para ${input.context.studentName}.`,
    });

    return {
      providerMessageId,
      status: 'ENVIADO' as const,
      message: input.message,
      log,
    };
  }
}
