import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermission('leads:read:school')
  list(@CurrentUser() user: { schoolId: string }) {
    return this.service.list(user.schoolId);
  }

  @Get('management')
  @RequirePermission('users:manage:school')
  management(@CurrentUser() user: { id: string; schoolId: string }) {
    return this.service.management(user.schoolId, user.id);
  }

  @Post()
  @RequirePermission('users:manage:school')
  create(
    @Body() body: CreateUserDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.service.create(user.schoolId, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('users:manage:school')
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.service.update(id, user.schoolId, user.id, body);
  }

  @Patch(':id/status')
  @RequirePermission('users:manage:school')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentUser() user: { id: string; schoolId: string },
  ) {
    return this.service.updateStatus(id, user.schoolId, user.id, body);
  }

  @Post(':id/reset-password')
  @RequirePermission('users:manage:school')
  resetPassword(
    @Param('id') id: string,
    @Body() body: ResetUserPasswordDto,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.service.resetPassword(id, user.schoolId, body.password);
  }
}
