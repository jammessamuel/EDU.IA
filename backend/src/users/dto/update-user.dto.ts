import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsIn(['SCHOOL_ADMIN', 'CONSULTANT'], {
    message: 'Perfil de acesso inválido',
  })
  roleName?: 'SCHOOL_ADMIN' | 'CONSULTANT';
}
