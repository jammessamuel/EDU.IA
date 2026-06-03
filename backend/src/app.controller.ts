import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Health-check público. O guard de JWT é global, então sem o @Public() um
  // GET / responderia 401 — e a Vercel manda "/" pra esta função (rewrite),
  // então deixo liberado pra servir de "tô no ar?".
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
