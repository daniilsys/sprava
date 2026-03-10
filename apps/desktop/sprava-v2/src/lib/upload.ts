import { api } from "./api";

interface PresignResult {
  fileUrl: string;
  uploadUrl: string;
  key: string;
}

async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
      "x-amz-acl": "public-read",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("S3 upload failed:", res.status, text);
    throw new Error(`Upload failed: ${res.status}`);
  }
}

export async function uploadAvatar(file: File): Promise<string> {
  const presign = (await api.uploads.presignAvatar({
    filename: file.name,
    contentType: file.type,
    size: file.size,
  })) as PresignResult;

  await uploadToS3(presign.uploadUrl, file);
  return presign.fileUrl;
}

export async function uploadServerIcon(file: File, serverId: string): Promise<string> {
  const presign = (await api.uploads.presignServerIcon({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    serverId,
  })) as PresignResult;

  await uploadToS3(presign.uploadUrl, file);
  return presign.fileUrl;
}

export async function uploadAttachment(file: File): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
  const presign = (await api.uploads.presignAttachment({
    filename: file.name,
    contentType: file.type,
    size: file.size,
  })) as PresignResult;

  await uploadToS3(presign.uploadUrl, file);

  return {
    url: presign.fileUrl,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
  };
}

export async function uploadGroupIcon(file: File, dmId: string): Promise<string> {
  const presign = (await api.uploads.presignGroupIcon({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    dmId,
  })) as PresignResult;

  await uploadToS3(presign.uploadUrl, file);
  return presign.fileUrl;
}
