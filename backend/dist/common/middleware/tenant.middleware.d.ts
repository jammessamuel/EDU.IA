import { NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
export declare class TenantMiddleware implements NestMiddleware {
    private readonly prisma;
    constructor(prisma: PrismaService);
    use(req: any, res: any, next: () => void): Promise<any>;
}
