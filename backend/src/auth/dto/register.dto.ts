import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter pelo menos 2 caracteres' })
  name: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Nome do workspace deve ter pelo menos 2 caracteres' })
  workspaceName: string;

  @IsOptional()
  @IsString()
  schoolName?: string; // alias retrocompatível

  @IsString({ message: 'Selecione um vertical' })
  verticalId: string;
}
