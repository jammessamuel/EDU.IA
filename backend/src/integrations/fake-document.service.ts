import { BadRequestException, Injectable } from '@nestjs/common';
import { FakeIntegrationContext, IntegrationLogDto } from './fake-services.types';
import { IntegrationLogService } from './integration-log.service';

export type FakeDocumentAction = 'RECEIVE' | 'APPROVE' | 'REJECT';

const DOCUMENT_RESULT: Record<FakeDocumentAction, { label: string; status: string; visible: string }> = {
  RECEIVE: {
    label: 'Recebida',
    status: 'RECEBIDO',
    visible: 'Documentação recebida no checklist fake.',
  },
  APPROVE: {
    label: 'Aprovada',
    status: 'APROVADO',
    visible: 'Documentação aprovada na conferência fake.',
  },
  REJECT: {
    label: 'Recusada',
    status: 'RECUSADO',
    visible: 'Documentação recusada na conferência fake.',
  },
};

export interface DocumentService {
  simulate(input: {
    context: FakeIntegrationContext;
    action: FakeDocumentAction;
    documentType?: string;
    reason?: string;
  }): Promise<{
    documentStatus: string;
    log: IntegrationLogDto;
  }>;
}

@Injectable()
export class FakeDocumentService implements DocumentService {
  constructor(private logs: IntegrationLogService) {}

  async simulate(input: { context: FakeIntegrationContext; action: FakeDocumentAction; documentType?: string; reason?: string }) {
    const result = DOCUMENT_RESULT[input.action];
    if (!result) throw new BadRequestException('Ação de documento fake não suportada.');

    const reason = input.reason?.trim() || 'Imagem ilegível ou documento incompleto.';
    const documentStatus = input.action === 'REJECT' ? `${result.label} - ${reason}` : result.label;
    const responsePayload = {
      documentType: input.documentType ?? 'Pacote de matrícula',
      status: result.status,
      reason: input.action === 'REJECT' ? reason : null,
    };

    const log = await this.logs.record({
      context: input.context,
      service: 'DOCUMENTOS',
      action: input.action,
      status: result.status,
      requestPayload: {
        documentType: input.documentType ?? 'Pacote de matrícula',
        reason: input.action === 'REJECT' ? reason : null,
      },
      responsePayload,
      visibleMessage: `${result.visible} Aluno: ${input.context.studentName}.`,
    });

    return {
      documentStatus,
      log,
    };
  }
}
