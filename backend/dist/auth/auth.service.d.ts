import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    register(dto: RegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            schoolId: string;
            schoolName: string;
            subdomain: string;
        };
    }>;
    login(dto: LoginDto, schoolId: string): Promise<{
        token: string;
        user: {
            id: string;
            name: string;
            email: string;
            schoolId: string;
            schoolName: string;
            subdomain: string;
        };
    }>;
    logout(userId: string): Promise<{
        ok: boolean;
    }>;
    private generateToken;
    private generateSubdomain;
}
