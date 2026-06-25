import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PostSaleController } from './post-sale.controller';
import { PostSaleService } from './post-sale.service';

@Module({
  imports: [PrismaModule],
  controllers: [PostSaleController],
  providers: [PostSaleService],
})
export class PostSaleModule {}
