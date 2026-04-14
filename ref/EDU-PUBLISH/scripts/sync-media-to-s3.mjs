import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'node:fs';
import path from 'node:path';
import { MEDIA_PREFIXES, siteUrlToStorageKey } from './lib/storage-paths.mjs';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET;
const TARGET_DIR = path.resolve(process.cwd(), 'dist');

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.zip': 'application/zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
};

function getAllFilesInDir(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFilesInDir(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const distFilePathToSiteUrl = (filePath) => {
  const relativePath = path.relative(TARGET_DIR, filePath).split(path.sep).join('/');
  return `/${relativePath}`;
};

async function getExistingObjects(bucketName) {
  const existingObjects = new Map();
  let isTruncated = true;
  let continuationToken = undefined;

  console.log('[s3-sync] Listing existing objects for incremental comparison...');

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    });
    try {
      const response = await s3Client.send(command);
      if (response.Contents) {
        response.Contents.forEach((item) => {
          existingObjects.set(item.Key, item.Size);
        });
      }
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    } catch (error) {
      console.error('[s3-sync] Failed to list objects, check credentials or bucket name:', error.message);
      process.exit(1);
    }
  }
  return existingObjects;
}

async function syncToS3() {
  if (!BUCKET_NAME || !process.env.S3_ENDPOINT) {
    console.log('[s3-sync] skipped: S3_BUCKET or S3_ENDPOINT not set (object storage is optional)');
    return;
  }

  let localFiles = [];
  MEDIA_PREFIXES.forEach((folder) => {
    const folderPath = path.join(TARGET_DIR, folder);
    localFiles = localFiles.concat(getAllFilesInDir(folderPath));
  });

  if (localFiles.length === 0) {
    console.log('[s3-sync] No attachments, covers, or img files found in dist/, skipping.');
    return;
  }

  const existingObjects = await getExistingObjects(BUCKET_NAME);
  console.log(`[s3-sync] Bucket contains ${existingObjects.size} existing objects.`);

  const filesToUpload = localFiles.filter((filePath) => {
    const objectKey = siteUrlToStorageKey(distFilePathToSiteUrl(filePath));
    const localSize = fs.statSync(filePath).size;

    if (!existingObjects.has(objectKey)) return true;
    if (existingObjects.get(objectKey) !== localSize) return true;
    return false;
  });

  if (filesToUpload.length === 0) {
    console.log('[s3-sync] All local files already exist with matching size, nothing to upload.');
    return;
  }

  console.log(`[s3-sync] ${filesToUpload.length} files to upload...`);

  const CONCURRENCY_LIMIT = 10;
  for (let i = 0; i < filesToUpload.length; i += CONCURRENCY_LIMIT) {
    const chunk = filesToUpload.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`[s3-sync] Uploading ${i + 1} to ${Math.min(i + CONCURRENCY_LIMIT, filesToUpload.length)}...`);

    const uploadPromises = chunk.map(async (filePath) => {
      const objectKey = siteUrlToStorageKey(distFilePathToSiteUrl(filePath));
      const fileStream = fs.createReadStream(filePath);
      const contentType = getMimeType(filePath);

      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: fileStream,
        ContentType: contentType,
      };

      try {
        await s3Client.send(new PutObjectCommand(uploadParams));
        console.log(`[s3-sync] uploaded: ${objectKey}`);
      } catch (error) {
        console.error(`[s3-sync] failed: ${objectKey}`, error.message);
      }
    });

    await Promise.all(uploadPromises);
  }

  console.log('[s3-sync] Incremental sync complete.');
}

syncToS3();
