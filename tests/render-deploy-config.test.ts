import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORED_ENV } from "@/lib/admin/health";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** แยก envVars ใน render.yaml เป็น { key, hasValue } (ไฟล์มีโครงเดียว ไม่ต้องใช้ YAML parser) */
function renderEnvVars(yaml: string): { key: string; hasValue: boolean }[] {
  return [...yaml.matchAll(/- key: (\S+)\r?\n\s+(value|sync):/g)].map((match) => ({ key: match[1], hasValue: match[2] === "value" }));
}

describe("Render deploy config (render.yaml)", () => {
  const yaml = read("render.yaml");
  const envVars = renderEnvVars(yaml);

  it("runs an always-on Starter service in Singapore, next to the Neon database", () => {
    expect(yaml).toMatch(/region: singapore/);
    expect(yaml).toMatch(/plan: starter/);
    expect(yaml).toMatch(/buildCommand: .*prisma generate.*npm run build/);
    expect(yaml).toMatch(/startCommand: npm start/);
  });

  it("leaves deploying to the tested deploy-hook workflow (Render auto-deploy off)", () => {
    expect(yaml).toMatch(/branch: main/);
    // ต้องมีเครื่องหมายคำพูด — off เปล่า ๆ ใน YAML 1.1 ถูกอ่านเป็น boolean false
    expect(yaml).toMatch(/autoDeployTrigger: "off"/);
  });

  it("declares every environment variable the status page monitors", () => {
    const declared = envVars.map((entry) => entry.key);
    MONITORED_ENV.forEach(({ key }) => expect(declared).toContain(key));
  });

  it("keeps secrets out of the file — only NODE_VERSION has a literal value", () => {
    expect(envVars.filter((entry) => entry.hasValue).map((entry) => entry.key)).toEqual(["NODE_VERSION"]);
  });
});

describe("Test-then-deploy workflow", () => {
  const workflow = read(".github/workflows/deploy.yml");

  it("runs on every push to main and tests against a real PostgreSQL before deploying", () => {
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(workflow).toMatch(/image: postgres:16/);
    expect(workflow).toContain("npx tsc --noEmit");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run test:integration");
    expect(workflow).toMatch(/deploy:\s*\n\s*needs: test/);
  });

  it("deploys exactly the tested commit through the secret hook without printing it", () => {
    expect(workflow).toContain("RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}");
    expect(workflow).toContain('"${RENDER_DEPLOY_HOOK}&ref=${GITHUB_SHA}"');
    expect(workflow).not.toMatch(/echo[^\n]*\$\{?RENDER_DEPLOY_HOOK/);
  });

  it("alerts admins when tests or the deploy fail (CLAUDE.md §5)", () => {
    expect(workflow).toMatch(/needs: \[test, deploy\]\s*\n\s*if: failure\(\)[\s\S]*api\.telegram\.org/);
  });
});

describe("Daily check-expiry job runs from GitHub Actions only", () => {
  const workflow = read(".github/workflows/check-expiry.yml");

  it("calls the cron endpoint over HTTPS with the shared CRON_SECRET", () => {
    expect(workflow).toMatch(/cron: "5 2 \* \* \*"/);
    expect(workflow).toContain('"${APP_URL}/api/cron/check-expiry"');
    expect(workflow).toContain('-H "Authorization: Bearer ${CRON_SECRET}"');
    expect(workflow).toContain("--proto '=https'");
  });

  it("alerts admins on failure instead of failing silently (CLAUDE.md §5)", () => {
    expect(workflow).toMatch(/if: failure\(\)[\s\S]*api\.telegram\.org/);
  });

  it("no longer schedules the same job in vercel.json (avoids double runs)", () => {
    expect(JSON.parse(read("vercel.json")).crons).toBeUndefined();
  });
});
