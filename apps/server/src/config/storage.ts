import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.DO_SPACES_REGION!;

export const s3 = new S3Client({
  endpoint: `https://${region}.digitaloceanspaces.com`,
  region,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
});

export const BUCKET = process.env.DO_SPACES_BUCKET!;

export const CDN_BASE =
  process.env.DO_SPACES_CDN_URL ??
  `https://${process.env.DO_SPACES_BUCKET}.${region}.digitaloceanspaces.com`;

export async function deleteSpacesObject(url: string): Promise<void> {
  const originBase = `https://${process.env.DO_SPACES_BUCKET}.${region}.digitaloceanspaces.com`;

  let key: string | undefined;
  if (url.startsWith(CDN_BASE + "/")) {
    key = url.slice(CDN_BASE.length + 1);
  } else if (url.startsWith(originBase + "/")) {
    key = url.slice(originBase.length + 1);
  }

  if (!key) return;

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {}
}
