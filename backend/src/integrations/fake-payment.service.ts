import { BadRequestException, Injectable } from '@nestjs/common';
import { FakeIntegrationContext, IntegrationLogDto } from './fake-services.types';
import { IntegrationLogService } from './integration-log.service';

export type FakePaymentAction = 'MARK_PAID' | 'FAIL' | 'REFUND' | 'PENDING';

const PAYMENT_RESULT: Record<FakePaymentAction, { label: string; status: string; visible: string }> = {
  MARK_PAID: {
    label: 'Pago',
    status: 'PAGO',
    visible: 'Pagamento aprovado no gateway fake.',
  },
  FAIL: {
    label: 'Falhou',
    status: 'FALHOU',
    visible: 'Pagamento recusado no gateway fake.',
  },
  REFUND: {
    label: 'Estornado',
    status: 'ESTORNADO',
    visible: 'Estorno registrado no gateway fake.',
  },
  PENDING: {
    label: 'Pendente',
    status: 'PENDENTE',
    visible: 'Cobrança mantida como pendente no gateway fake.',
  },
};

export interface PaymentService {
  simulate(input: { context: FakeIntegrationContext; action: FakePaymentAction; amount?: number }): Promise<{
    paymentRef: string;
    paymentStatus: string;
    log: IntegrationLogDto;
  }>;
}

@Injectable()
export class FakePaymentService implements PaymentService {
  constructor(private logs: IntegrationLogService) {}

  async simulate(input: { context: FakeIntegrationContext; action: FakePaymentAction; amount?: number }) {
    const result = PAYMENT_RESULT[input.action];
    if (!result) throw new BadRequestException('Ação de pagamento fake não suportada.');

    const paymentRef = `fake-pay-${Date.now()}`;
    const responsePayload = {
      paymentRef,
      status: result.status,
      amount: input.amount ?? 150,
      method: 'PIX',
    };

    const log = await this.logs.record({
      context: input.context,
      service: 'PAGAMENTO',
      action: input.action,
      status: result.status,
      requestPayload: {
        amount: input.amount ?? 150,
        method: 'PIX',
      },
      responsePayload,
      visibleMessage: `${result.visible} Aluno: ${input.context.studentName}.`,
    });

    return {
      paymentRef,
      paymentStatus: result.label,
      log,
    };
  }
}
