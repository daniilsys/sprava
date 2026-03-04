import { prisma } from "../../config/db.js";
import type { UpdateSettingsDto } from "./settings.schema.js";
import { toSettingsResponse } from "../users/users.mapper.js";

export class SettingsService {
  async getSettings(userId: string) {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) return null;
    return toSettingsResponse(settings);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const settings = await prisma.userSettings.update({
      where: { userId },
      data: dto,
    });
    return toSettingsResponse(settings);
  }
}
