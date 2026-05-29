import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentSchool = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<any>().schoolId,
);
