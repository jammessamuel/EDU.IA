import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostSaleService } from './post-sale.service';

@Controller('post-sales')
export class PostSaleController {
  constructor(private readonly service: PostSaleService) {}

  @Get('overview')
  @RequirePermission('leads:read:school')
  overview(@CurrentUser() user: { schoolId: string }): Promise<unknown> {
    return this.service.overview(user.schoolId);
  }
}
