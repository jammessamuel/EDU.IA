import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const schoolId: string = req.schoolId;
    return this.authService.login(dto, schoolId);
  }

  @Get('me')
  async me(@CurrentUser() user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      schoolId: user.schoolId,
    };
  }

  @Post('logout')
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }
}
