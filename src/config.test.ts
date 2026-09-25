import { loadConfig } from "./config";

// NodeJS.ProcessEnv requires NODE_ENV (via Next.js's global augmentation),
// but loadConfig only reads the keys it's given — bare fixtures below are
// deliberately missing it and other real env vars.
function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

const base = {
  S3_BUCKET: "artsy-atelier",
  CLOUDFRONT_DISTRIBUTION_ID: "E123",
};

describe("loadConfig", () => {
  it("parses a complete env with correct types", () => {
    const cfg = loadConfig(env({ ...base, PORT: "3000", MAX_UPLOAD_BYTES: "1024" }));
    expect(cfg.s3Bucket).toBe("artsy-atelier");
    expect(cfg.cloudfrontDistributionId).toBe("E123");
    expect(cfg.port).toBe(3000);
    expect(cfg.maxUploadBytes).toBe(1024);
  });

  it("applies defaults for optional vars", () => {
    const cfg = loadConfig(env(base));
    expect(cfg.s3Region).toBe("us-east-1");
    expect(cfg.publicDomain).toBe("artsy.dev");
    expect(cfg.port).toBe(8080);
    expect(cfg.maxUploadBytes).toBe(52428800);
  });

  it("throws naming every missing required var", () => {
    expect(() => loadConfig(env({}))).toThrow(/S3_BUCKET/);
    expect(() => loadConfig(env({}))).toThrow(/CLOUDFRONT_DISTRIBUTION_ID/);
  });

  it("throws on a non-numeric numeric var", () => {
    expect(() => loadConfig(env({ ...base, PORT: "abc" }))).toThrow(/PORT/);
  });
});
