import fs from "node:fs";
import { chromium } from "patchright";
import { startTestServer } from "../test/helpers/test-server.js";

const bundle = fs.readFileSync("./dist/browser.js", "utf-8");
const server = await startTestServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
page.on("console", (msg) => console.log("CONSOLE", msg.type(), msg.text()));

await page.goto(`${server.baseUrl}/harness`, { waitUntil: "networkidle" });

const result = await page.evaluate((code) => {
  const blob = new Blob([code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<Record<string, unknown>>;

  return dynamicImport(url)
    .then((detection) => {
      URL.revokeObjectURL(url);
      window.__detection = detection;
      window.__harnessReady = true;
      return { ok: true, keys: Object.keys(detection).slice(0, 3) };
    })
    .catch((error: unknown) => ({
      ok: false,
      err: error instanceof Error ? error.message : String(error),
    }));
}, bundle);

console.log("inject:", result);
console.log("ready:", await page.evaluate(() => window.__harnessReady));

await browser.close();
await server.close();
