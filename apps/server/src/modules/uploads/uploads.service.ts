import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import path from "path";
import { s3, BUCKET, CDN_BASE } from "../../config/storage.js";
import { prisma } from "../../config/db.js";
import { checkPermission } from "../../utils/checkPermission.js";
import { Permission } from "@sprava/shared";
import { AppError } from "../../utils/AppError.js";
import type {
  AvatarPresignDto,
  AttachmentPresignDto,
  ServerIconPresignDto,
  GroupIconPresignDto,
} from "./uploads.schema.js";

// Maps MIME type → file extension
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".weba",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "application/zip": ".zip",
  "application/x-tar": ".tar",
  "application/gzip": ".gz",
};

const PRESIGN_TTL = 5 * 60; // 5 minutes

async function presign(
  key: string,
  contentType: string,
  size: number,
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    ACL: "public-read",
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGN_TTL,
    unhoistableHeaders: new Set(["x-amz-acl"]),
  });
  const fileUrl = `${CDN_BASE}/${key}`;

  return { uploadUrl, fileUrl, key };
}

export class UploadsService {
  async presignAvatar(dto: AvatarPresignDto, userId: string) {
    const ext =
      EXTENSIONS[dto.contentType] ?? path.extname(dto.filename).toLowerCase();
    const key = `avatars/${userId}/${randomBytes(8).toString("hex")}${ext}`;
    return presign(key, dto.contentType, dto.size);
  }

  async presignAttachment(dto: AttachmentPresignDto, userId: string) {
    const ext =
      EXTENSIONS[dto.contentType] ?? path.extname(dto.filename).toLowerCase();
    const key = `attachments/${userId}/${randomBytes(16).toString("hex")}${ext}`;
    return presign(key, dto.contentType, dto.size);
  }

  async presignServerIcon(dto: ServerIconPresignDto, userId: string) {
    await checkPermission(userId, dto.serverId, Permission.CONFIGURE_SERVER);

    const ext =
      EXTENSIONS[dto.contentType] ?? path.extname(dto.filename).toLowerCase();
    const key = `server-icons/${dto.serverId}/${randomBytes(8).toString("hex")}${ext}`;
    return presign(key, dto.contentType, dto.size);
  }

  async presignGroupIcon(dto: GroupIconPresignDto, userId: string) {
    const dm = await prisma.dmConversation.findUnique({
      where: { id: dto.dmId, type: "GROUP" },
    });

    if (!dm) throw new AppError("Group DM not found", 404, "DM_NOT_FOUND");
    if (dm.ownerId !== userId)
      throw new AppError(
        "Only the group owner can change the icon",
        403,
        "NOT_DM_OWNER",
      );

    const ext =
      EXTENSIONS[dto.contentType] ?? path.extname(dto.filename).toLowerCase();
    const key = `group-icons/${dto.dmId}/${randomBytes(8).toString("hex")}${ext}`;
    return presign(key, dto.contentType, dto.size);
  }
}
