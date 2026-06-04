import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:15174/vp-dashboard", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const topSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Top Alerts" }) });
  const firstRow = topSection.locator("tbody tr").first();
  await firstRow.waitFor({ timeout: 15000 });
  const issueId = (await firstRow.locator("td").first().textContent())?.trim();
  console.log("First top alert:", issueId);

  await firstRow.getByRole("button", { name: /View Issue/ }).click();
  await page.waitForURL(/\/vp\/issue\//, { timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.waitForURL(/\/vp\/closure\//, { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "Return to Dashboard" }).click();
  await page.waitForURL(/\/vp-dashboard/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const ids = await topSection.locator("tbody tr td:first-child").allTextContents();
  const trimmed = ids.map((s) => s.trim());
  console.log("Top alerts after return:", trimmed.join(", "));
  console.log("Approved still visible?", trimmed.includes(issueId));
  if (errors.length) console.log("Page errors:", errors.join(" | "));
  process.exit(trimmed.includes(issueId) ? 1 : 0);
} catch (e) {
  console.error("TEST FAILED:", e.message);
  if (errors.length) console.log("Page errors:", errors.join(" | "));
  process.exit(2);
} finally {
  await browser.close();
}
