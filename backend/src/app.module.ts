import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SimulatorModule } from './simulator/simulator.module';
import { AuthModule } from './auth/auth.module';
import { VerticalModule } from './vertical/vertical.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SimulatorModule,
    VerticalModule,
  ],
  providers: [
    // JWT primeiro — popula req.user antes do RBAC verificar permissões
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
