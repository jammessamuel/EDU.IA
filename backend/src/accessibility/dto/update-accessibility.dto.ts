import { IsBoolean, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { COLOR_BLIND_MODES, type ColorBlindMode } from '../accessibility.types';

export class UpdateAccessibilityDto {
  @IsOptional()
  @IsBoolean()
  screenReader?: boolean;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsIn(COLOR_BLIND_MODES)
  colorBlindMode?: ColorBlindMode;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  simpleLanguage?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.9)
  @Max(1.35)
  fontScale?: number;
}
