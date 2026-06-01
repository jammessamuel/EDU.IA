import { Controller, Get, Param } from '@nestjs/common';
import { VerticalService } from './vertical.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('verticals')
@Public()
export class VerticalController {
  constructor(private readonly verticalService: VerticalService) {}

  @Get()
  findAll() {
    return this.verticalService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.verticalService.findBySlug(slug);
  }
}
