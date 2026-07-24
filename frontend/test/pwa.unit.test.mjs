import assert from "node:assert/strict";
import test from "node:test";
import { devicePlatform, isStandaloneApp } from "../src/utils/pwa.js";

test("reconhece Android por user agent e Client Hints", () => {
  assert.equal(devicePlatform({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)" } }), "android");
  assert.equal(devicePlatform({ navigator: { userAgent: "Mozilla/5.0", userAgentData: { platform: "Android" } } }), "android");
});

test("reconhece iOS e execução instalada", () => {
  assert.equal(devicePlatform({ navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" } }), "ios");
  assert.equal(isStandaloneApp({ navigator: {}, matchMedia: () => ({ matches: true }) }), true);
  assert.equal(isStandaloneApp({ navigator: {}, matchMedia: () => ({ matches: false }) }), false);
});

test("diferencia navegador desktop para adaptar as instruções de instalação", () => {
  assert.equal(devicePlatform({ navigator: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }), "desktop");
  assert.equal(devicePlatform({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }), "desktop");
});
