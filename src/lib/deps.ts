import { CloudFrontClient } from "@aws-sdk/client-cloudfront";
import { S3Client } from "@aws-sdk/client-s3";
import { type Config, loadConfig } from "../config";

// Pages API routes have no createApp(deps) seam to construct these once at
// startup — each route module reaches for module-scope singletons instead.
// This deliberately gives up the app's zero-module-state property.
let config: Config | undefined;
let s3Client: S3Client | undefined;
let cloudFrontClient: CloudFrontClient | undefined;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig(process.env);
  }
  return config;
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: getConfig().s3Region });
  }
  return s3Client;
}

export function getCloudFrontClient(): CloudFrontClient {
  if (!cloudFrontClient) {
    cloudFrontClient = new CloudFrontClient({ region: getConfig().s3Region });
  }
  return cloudFrontClient;
}

// Test-only: clearMocks doesn't reset this module's state between tests.
export function resetDeps(): void {
  config = undefined;
  s3Client = undefined;
  cloudFrontClient = undefined;
}
