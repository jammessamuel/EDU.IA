import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  name: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  password: string;

  @IsIn(['SCHOOL_ADMIN', 'CONSULTANT'], {
    message: 'Perfil de acesso inválido',
  })
  roleName: 'SCHOOL_ADMIN' | 'CONSULTANT';
}
