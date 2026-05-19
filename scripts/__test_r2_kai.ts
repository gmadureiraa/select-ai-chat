import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({
  region: "auto",
  endpoint: "https://51a70bff3fbc2d3354d5efe4c75fa1ae.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "54f770082c75c02c2cbf19abd20450e5",
    secretAccessKey: "9079bf2afae2db2ba87ab9784f1a5fa641411b531ddc25aad5fd2004affa653f",
  },
});
const tinyPng = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
  "1f15c4890000000d49444154789c63f8ffff3f0005fe02fe707d3d4e0000000049454e44ae426082",
  "hex"
);
const key = `__health/kai-test-${Date.now()}.png`;
await s3.send(new PutObjectCommand({
  Bucket: "kai-app",
  Key: key,
  Body: tinyPng,
  ContentType: "image/png",
  CacheControl: "public, max-age=300",
}));
const pubUrl = `https://pub-ecd5406cec2e4f338221ea403452ad8d.r2.dev/${key}`;
const probe = await fetch(pubUrl);
console.log("PUT OK; pub URL:", pubUrl, "→", probe.status, probe.headers.get("content-type"));
