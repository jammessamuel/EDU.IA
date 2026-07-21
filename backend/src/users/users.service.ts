import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
