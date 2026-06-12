import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  COLOR_BLIND_MODES,
  DEFAULT_ACCESSIBILITY_PROFILE,
  type AccessibilityProfile,
  type ColorBlindMode,
} from './accessibility.types';
import { UpdateAccessibilityDto } from './dto/update-accessibility.dto';

const SELECT = {
  screenReader: true,
  highContrast: true,
  colorBlindMode: true,
  reduceMotion: true,
  simpleLanguage: true,
  fontScale: true,
} as const;

@Injectable()
export class AccessibilityService {
  constructor(private prisma: PrismaService) {}

  async getForUser(userId: string): Promise<AccessibilityProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.toProfile(user);
  }

  async updateForUser(userId: string, dto: UpdateAccessibilityDto): Promise<AccessibilityProfile> {
    const data = this.sanitize(dto);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: SELECT,
    });
    return this.toProfile(user);
  }

  private sanitize(dto: UpdateAccessibilityDto) {
    const data: Partial<AccessibilityProfile> = {};
    if (typeof dto.screenReader === 'boolean') data.screenReader = dto.screenReader;
    if (typeof dto.highContrast === 'boolean') data.highContrast = dto.highContrast;
    if (typeof dto.reduceMotion === 'boolean') data.reduceMotion = dto.reduceMotion;
    if (typeof dto.simpleLanguage === 'boolean') data.simpleLanguage = dto.simpleLanguage;
    if (dto.colorBlindMode && COLOR_BLIND_MODES.includes(dto.colorBlindMode)) {
      data.colorBlindMode = dto.colorBlindMode;
    }
    if (typeof dto.fontScale === 'number') {
      data.fontScale = Math.min(1.35, Math.max(0.9, Number(dto.fontScale.toFixed(2))));
    }
    return data;
  }

  private toProfile(user: {
    screenReader: boolean | null;
    highContrast: boolean | null;
    colorBlindMode: string | null;
    reduceMotion: boolean | null;
    simpleLanguage: boolean | null;
    fontScale: number | null;
  }): AccessibilityProfile {
    const colorBlindMode = COLOR_BLIND_MODES.includes(user.colorBlindMode as ColorBlindMode)
      ? (user.colorBlindMode as ColorBlindMode)
      : DEFAULT_ACCESSIBILITY_PROFILE.colorBlindMode;

    return {
      screenReader: user.screenReader ?? DEFAULT_ACCESSIBILITY_PROFILE.screenReader,
      highContrast: user.highContrast ?? DEFAULT_ACCESSIBILITY_PROFILE.highContrast,
      colorBlindMode,
      reduceMotion: user.reduceMotion ?? DEFAULT_ACCESSIBILITY_PROFILE.reduceMotion,
      simpleLanguage: user.simpleLanguage ?? DEFAULT_ACCESSIBILITY_PROFILE.simpleLanguage,
      fontScale: user.fontScale ?? DEFAULT_ACCESSIBILITY_PROFILE.fontScale,
    };
  }
}
