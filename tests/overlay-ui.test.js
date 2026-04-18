const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const overlayHtml = fs.readFileSync(path.join(__dirname, "..", "overlay", "index.html"), "utf8");

test("theme labels use explicit color wording", () => {
  assert.match(overlayHtml, /<label for="bgColorInput">Background color<\/label>/);
  assert.match(overlayHtml, /<label for="textColorInput">Text color<\/label>/);
});

test("color input is styled as a circle across browsers", () => {
  assert.match(overlayHtml, /\.config-input\[type="color"\][\s\S]*border-radius:\s*50%/);
  assert.match(overlayHtml, /::-webkit-color-swatch[\s\S]*border-radius:\s*50%/);
  assert.match(overlayHtml, /::-moz-color-swatch[\s\S]*border-radius:\s*50%/);
});

test("single circular color button component exists", () => {
  assert.match(overlayHtml, /\.color-circle-button\s*\{[\s\S]*width:\s*28px;[\s\S]*height:\s*28px;[\s\S]*border-radius:\s*50%;/);
  assert.match(overlayHtml, /\.color-circle-button:hover,[\s\S]*\.color-circle-button:focus-visible/);
  assert.match(overlayHtml, /\.color-circle-button\.selected\s*\{[\s\S]*box-shadow:/);
});

test("theme section uses one color button per field", () => {
  assert.match(overlayHtml, /id="bgColorButton" type="button" class="color-circle-button selected"/);
  assert.match(overlayHtml, /id="textColorButton" type="button" class="color-circle-button selected"/);
  assert.match(overlayHtml, /id="bgColorInput" class="config-input color-input-hidden" type="color"/);
  assert.match(overlayHtml, /id="textColorInput" class="config-input color-input-hidden" type="color"/);
  assert.match(overlayHtml, /function initializeColorCircleButtons\(/);
  assert.doesNotMatch(overlayHtml, /function initializeColorSwatches\(/);
});

test("glass theme includes tint color picker control", () => {
  assert.match(overlayHtml, /id="glassTintColorButton" type="button" class="color-circle-button selected"/);
  assert.match(overlayHtml, /id="glassTintColorInput" class="config-input color-input-hidden" type="color" value="#ffffff"/);
  assert.match(overlayHtml, /const DEFAULT_GLASS_TINT_COLOR = "#ffffff"/);
});

test("glass sliders trigger live theme preview updates", () => {
  assert.match(overlayHtml, /\["glassBlurPxInput", "glassTintOpacityInput", "glassBorderOpacityInput", "glassShadowStrengthInput"\]\.forEach/);
  assert.match(overlayHtml, /input\.addEventListener\("input", \(\) => \{[\s\S]*previewThemeFromInputs\(\);/);
});

test("glass section exists and starts hidden until theme is glass", () => {
  assert.match(overlayHtml, /id="glassConfigGroup" class="config-group glass-config-group"/);
  assert.match(overlayHtml, /\.glass-config-group\s*\{[\s\S]*display:\s*none;/);
  assert.match(overlayHtml, /\.glass-config-group\.visible\s*\{[\s\S]*display:\s*grid;/);
});

test("theme border-style selector is removed from UI", () => {
  assert.doesNotMatch(overlayHtml, /id="borderStyleInput"/);
});

test("rank refresh logic preserves active theme if payload theme is absent", () => {
  assert.match(overlayHtml, /const hasPayloadTheme = typeof json\.overlayBackgroundTheme === "string"/);
  assert.match(overlayHtml, /: currentOverlayBackgroundTheme;/);
});
