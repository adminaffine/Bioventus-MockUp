import { chromium } from "playwright";

const baseUrl = process.env.UI_BASE_URL ?? "http://localhost:5173";
const apiRewriteFrom = process.env.API_REWRITE_FROM;
const apiRewriteTo = process.env.API_REWRITE_TO;

const routes = [
  "/",
  "/upload",
  "/profiler?dataset=customer_master",
  "/integration",
  "/compliance",
  "/trend",
  "/pii-shield",
  "/governance",
  "/rx-integrity",
  "/capa",
  "/products",
  "/application-guide",
  "/commercial",
  "/hierarchy",
  "/hierarchy?customer=CUST-1028",
  "/revenue",
  "/revenue?tab=gpo",
  "/revenue?tab=copq",
  "/revenue?tab=tax&highlight=ORD-005",
  "/alerts",
  "/alerts?severity=critical",
  "/alerts?severity=high",
  "/profiler?dataset=sales_orders&filter=orphan",
];

const allowConsoleError = [/favicon/i, /ResizeObserver loop limit exceeded/i];

function isAllowedConsoleError(text) {
  return allowConsoleError.some((pattern) => pattern.test(text));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

if (apiRewriteFrom && apiRewriteTo) {
  await page.route(`${apiRewriteFrom}/**`, async (route) => {
    const requestUrl = route.request().url();
    const rewrittenUrl = requestUrl.replace(apiRewriteFrom, apiRewriteTo);
    await route.continue({ url: rewrittenUrl });
  });
}

const failures = [];
const diagnostics = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  const routeErrors = [];

  page.removeAllListeners("pageerror");
  page.removeAllListeners("console");

  page.on("pageerror", (error) => {
    routeErrors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isAllowedConsoleError(text)) return;
    routeErrors.push(`console error: ${text}`);
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1200);
  } catch (error) {
    routeErrors.push(`navigation failed: ${String(error)}`);
  }

  const rootState = await page.evaluate(() => {
    const root = document.querySelector("#root");
    if (!root) return { hasRoot: false, hasRenderable: false, textLength: 0 };
    const textLength = (root.textContent ?? "").trim().length;
    const hasRenderable = !!root.firstElementChild || textLength > 0;
    return { hasRoot: true, hasRenderable, textLength };
  });

  if (!rootState.hasRoot || !rootState.hasRenderable) {
    routeErrors.push("root content appears blank");
  }

  if (routeErrors.length > 0) {
    failures.push({ route, errors: routeErrors });
  } else {
    diagnostics.push(`${route} OK`);
  }
}

await browser.close();

for (const line of diagnostics) {
  console.log(line);
}

if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const failure of failures) {
    console.log(`- ${failure.route}`);
    for (const error of failure.errors) {
      console.log(`  - ${error}`);
    }
  }
  process.exitCode = 1;
} else {
  console.log("\nAll checked routes rendered without runtime errors.");
}
