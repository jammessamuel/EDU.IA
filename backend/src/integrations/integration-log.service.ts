import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationLogDto, IntegrationLogInput } from './fake-services.types';

@Injectable()
export class IntegrationLogService {
  constructor(private prisma: PrismaService) {}

  async record(input: IntegrationLogInput): Promise<IntegrationLogDto> {
    const log = await this.prisma.integrationLog.create({
      data: {
        schoolId: input.context.schoolId,
        studentKey: input.context.studentKey,
        enrollmentId: input.context.enrollmentId,
        studentName: input.context.studentName,
        service: input.service,
        action: input.action,
        status: input.status,
        requestPayload: JSON.stringify(input.requestPayload ?? {}),
        responsePayload: JSON.stringify(input.responsePayload ?? {}),
        visibleMessage: input.visibleMessage,
      },
    });
    return this.serialize(log);
  }

  async recent(schoolId: string, take = 12): Promise<IntegrationLogDto[]> {
    const logs = await this.prisma.integrationLog.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return logs.map((log) => this.serialize(log));
  }

  private serialize(log: any): IntegrationLogDto {
    return {
      id: log.id,
      schoolId: log.schoolId,
      studentKey: log.studentKey,
      enrollmentId: log.enrollmentId,
      studentName: log.studentName,
      service: log.service,
      action: log.action,
      status: log.status,
      requestPayload: this.safeParse(log.requestPayload),
      responsePayload: this.safeParse(log.responsePayload),
      visibleMessage: log.visibleMessage,
      createdAt: log.createdAt,
    };
  }

  private safeParse(value: string | null | undefined): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
