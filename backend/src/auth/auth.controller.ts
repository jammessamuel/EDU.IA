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
  async login(@Body() dto: LoginDto, @Req() req: { schoolId: string }) {
    const schoolId: string = req.schoolId;
    return this.authService.login(dto, schoolId);
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.authService.me(user.id, user.schoolId);
  }

  @Post('logout')
  async logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }
}
