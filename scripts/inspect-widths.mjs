#!/usr/bin/env node
// Measure the <main>, <header>, <nav>, and content area widths across every
// route to see where the SPA chrome actually diverges in the rendered DOM.

import fs from "node:fs";
import puppeteer from "puppeteer-core";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "").replace(/\\\$/g, "$");
}

const PW = process.env.APP_PASSWORD;
if (!PW) {
  console.error(
    "Set APP_PASSWORD=xxx before running: node scripts/inspect-widths.mjs",
  );
  process.exit(1);
}

const CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const ROUTES = [
  "/shopping",
  "/plan",
  "/recipes",
  "/ingredients",
  "/settings",
];
const VIEWPORT = { width: 1280, height: 900 };

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: "new",
  args: ["--window-size=1280,900"],
});

try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Log in once so the proxy-cookie is set for subsequent navigations.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type('input[name="password"]', PW);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);

  console.log(
    `viewport: ${VIEWPORT.width}x${VIEWPORT.height}  (route · main · header · nav)`,
  );

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle0" });
    // Give react-query a beat to swap out the loading state.
    await new Promise((r) => setTimeout(r, 600));
    const info = await page.evaluate(() => {
      const bodyWidth = document.body.getBoundingClientRect().width;
      const main = document.querySelector("main");
      const header = document.querySelector("header");
      const nav = document.querySelector("header nav");
      const mainRect = main?.getBoundingClientRect();
      const headerRect = header?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      function fmt(r) {
        return r ? `${Math.round(r.width)}@${Math.round(r.left)}` : "–";
      }
      return {
        body: Math.round(bodyWidth),
        main: fmt(mainRect),
        header: fmt(headerRect),
        nav: fmt(navRect),
        mainClass: main?.className ?? "",
      };
    });
    console.log(
      `${route.padEnd(14)}  body=${info.body}  main=${info.main}  header=${info.header}  nav=${info.nav}`,
    );
    console.log(`                 main.class = ${info.mainClass}`);
  }
} finally {
  await browser.close();
}
