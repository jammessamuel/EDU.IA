import { Body, Controller, Get, Put, UsePipes, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessibilityService } from './accessibility.service';
import { UpdateAccessibilityDto } from './dto/update-accessibility.dto';

@Controller('me/accessibility')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AccessibilityController {
  constructor(private accessibility: AccessibilityService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.accessibility.getForUser(user.id);
  }

  @Put()
  update(@CurrentUser() user: { id: string }, @Body() dto: UpdateAccessibilityDto) {
    return this.accessibility.updateForUser(user.id, dto);
  }
}
