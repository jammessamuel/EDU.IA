export type FakeIntegrationService =
  | 'WHATSAPP'
  | 'PAGAMENTO'
  | 'CONTRATO'
  | 'DOCUMENTOS'
  | 'ALERTAS';

export interface FakeIntegrationContext {
  schoolId: string;
  studentKey: string | null;
  enrollmentId: string | null;
  studentName: string;
}

export interface IntegrationLogDto {
  id: string;
  schoolId: string;
  studentKey: string | null;
  enrollmentId: string | null;
  studentName: string | null;
  service: FakeIntegrationService;
  action: string;
  status: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  visibleMessage: string;
  createdAt: Date;
}

export interface IntegrationLogInput {
  context: FakeIntegrationContext;
  service: FakeIntegrationService;
  action: string;
  status: string;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  visibleMessage: string;
}
