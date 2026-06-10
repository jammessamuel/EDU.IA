import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface PaymentRequest {
  amount: number;
  method?: string | null;
  customerName: string;
  customerEmail?: string | null;
}

export interface PaymentResult {
  status: 'APROVADO' | 'PENDENTE' | 'RECUSADO';
  provider: 'SIMULADO';
  reference: string;
  message: string;
}

@Injectable()
export class PaymentProvider {
  async charge(input: PaymentRequest): Promise<PaymentResult> {
    const method = input.method || 'PIX';

    return {
      status: 'APROVADO',
      provider: 'SIMULADO',
      reference: `SIMULADO-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
      message: `Pagamento simulado aprovado via ${method} para demonstração. Nenhuma cobrança real foi feita.`,
    };
  }
}
