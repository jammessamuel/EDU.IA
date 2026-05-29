import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    login(dto: LoginDto, req: any): Promise<{
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
    me(user: any): Promise<{
        id: any;
        name: any;
        email: any;
        schoolId: any;
    }>;
    logout(user: any): Promise<{
        ok: boolean;
    }>;
}
