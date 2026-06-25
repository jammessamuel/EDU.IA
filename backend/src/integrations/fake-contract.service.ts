import { BadRequestException, Injectable } from '@nestjs/common';
import { FakeIntegrationContext, IntegrationLogDto } from './fake-services.types';
import { IntegrationLogService } from './integration-log.service';

export type FakeContractAction = 'SEND' | 'VIEW' | 'SIGN' | 'EXPIRE';

const CONTRACT_RESULT: Record<FakeContractAction, { label: string; status: string; visible: string }> = {
  SEND: {
    label: 'Enviado',
    status: 'ENVIADO',
    visible: 'Contrato enviado pela plataforma de assinatura fake.',
  },
  VIEW: {
    label: 'Visualizado',
    status: 'VISUALIZADO',
    visible: 'Contrato visualizado pelo aluno no ambiente fake.',
  },
  SIGN: {
    label: 'Assinado',
    status: 'ASSINADO',
    visible: 'Contrato assinado no ambiente fake.',
  },
  EXPIRE: {
    label: 'Expirado',
    status: 'EXPIRADO',
    visible: 'Link do contrato expirado no ambiente fake.',
  },
};

export interface ContractService {
  simulate(input: { context: FakeIntegrationContext; action: FakeContractAction }): Promise<{
    contractUrl: string;
    contractStatus: string;
    log: IntegrationLogDto;
  }>;
}

@Injectable()
export class FakeContractService implements ContractService {
  constructor(private logs: IntegrationLogService) {}

  async simulate(input: { context: FakeIntegrationContext; action: FakeContractAction }) {
    const result = CONTRACT_RESULT[input.action];
    if (!result) throw new BadRequestException('Ação de contrato fake não suportada.');

    const contractUrl = `https://fake-contract.local/contracts/${input.context.studentKey}`;
    const responsePayload = {
      contractUrl,
      status: result.status,
      provider: 'FakeSign',
    };

    const log = await this.logs.record({
      context: input.context,
      service: 'CONTRATO',
      action: input.action,
      status: result.status,
      requestPayload: {
        provider: 'FakeSign',
        studentKey: input.context.studentKey,
      },
      responsePayload,
      visibleMessage: `${result.visible} Aluno: ${input.context.studentName}.`,
    });

    return {
      contractUrl,
      contractStatus: result.label,
      log,
    };
  }
}
