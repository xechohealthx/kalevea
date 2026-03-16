import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

const s3 = new S3Client({
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function createSignedUploadUrl(input: {
  storageKey: string;
  mimeType: string;
  checksumSha256?: string;
  expiresInSeconds?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.storageKey,
    ContentType: input.mimeType,
    Metadata: input.checksumSha256 ? { sha256: input.checksumSha256 } : undefined,
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: input.expiresInSeconds ?? 300,
  });

  return uploadUrl;
}

export async function createSignedDownloadUrl(input: {
  storageKey: string;
  expiresInSeconds?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.storageKey,
  });

  const downloadUrl = await getSignedUrl(s3, command, {
    expiresIn: input.expiresInSeconds ?? 120,
  });

  return downloadUrl;
}

export async function verifyObjectExists(input: { storageKey: string }) {
  const result = await s3.send(
    new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
    }),
  );

  return {
    contentLength: Number(result.ContentLength ?? 0),
    contentType: result.ContentType ?? "",
    metadata: result.Metadata ?? {},
    etag: result.ETag ?? null,
    lastModified: result.LastModified ?? null,
  };
}

export async function deleteObject(input: { storageKey: string }) {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
    }),
  );
}

export async function readObjectAsText(input: { storageKey: string }) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.storageKey,
    }),
  );

  if (!result.Body) return "";
  return result.Body.transformToString();
}
