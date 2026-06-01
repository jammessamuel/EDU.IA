import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VerticalField {
  name: string;
  label: string;
  type: 'text' | 'select';
  options: string[] | null;
  required: boolean;
  order: number;
}

export interface VerticalStage {
  key: string;
  label: string;
  color: string;
}

@Injectable()
export class VerticalService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const verticals = await this.prisma.vertical.findMany({
      orderBy: { name: 'asc' },
    });
    return verticals.map(this.serialize);
  }

  async findBySlug(slug: string) {
    const v = await this.prisma.vertical.findUnique({ where: { slug } });
    if (!v) throw new NotFoundException(`Vertical "${slug}" não encontrado`);
    return this.serialize(v);
  }

  async getFieldsForWorkspace(schoolId: string): Promise<VerticalField[]> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });
    const raw = school?.customFields ?? school?.vertical?.defaultFields ?? '[]';
    return JSON.parse(raw) as VerticalField[];
  }

  async getStagesForWorkspace(schoolId: string): Promise<VerticalStage[]> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });
    const raw = school?.customStages ?? school?.vertical?.defaultStages ?? '[]';
    return JSON.parse(raw) as VerticalStage[];
  }

  private serialize(v: any) {
    return {
      id:    v.id,
      slug:  v.slug,
      name:  v.name,
      icon:  v.icon,
      color: v.color,
      fields:  JSON.parse(v.defaultFields)  as VerticalField[],
      stages:  JSON.parse(v.defaultStages)  as VerticalStage[],
    };
  }
}
