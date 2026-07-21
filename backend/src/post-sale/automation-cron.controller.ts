import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PostSaleService } from './post-sale.service';

@Controller('internal/automation')
export class AutomationCronController {
  constructor(private readonly postSale: PostSaleService) {}

  @Get('run')
  @Public()
  run(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Cron não autorizado.');
    }
    return this.postSale.runScheduledAutomation();
  }
}
