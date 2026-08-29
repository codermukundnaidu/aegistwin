import { expect, test } from "@playwright/test";

test("demo renders interactive 3D scene and computed safety UI", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /AI that can advise/i })).toBeVisible();
  await expect(page.getByText(/PASS/).first()).toBeVisible();
  await expect(page.getByText(/OBC Proposal Contract/i)).toBeVisible();
  await expect(page.getByText(/AEGIS-TWIN \/\/ ORBITAL FDIR BENCHMARK/i)).toBeVisible();
  await page.getByRole("button", { name: /INJECT ADCS THERMAL RUNAWAY/i }).click();
  await expect(page.getByText(/ADCS Thermal Spike/i)).toBeVisible();
  await expect(page.getByText(/RADIO SILENCE \/ ECLIPSE/i)).toBeVisible();

  const globe = page.locator(".globe-canvas").first();
  const cubeSat = page.locator("#cubesat-canvas canvas").first();
  const orbitTrack = page.locator(".orbit-track-canvas").first();
  await expect(globe).toBeVisible();
  await expect(cubeSat).toBeVisible();
  await expect(orbitTrack).toBeVisible();
  const box = await cubeSat.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(240);
  expect(box?.height ?? 0).toBeGreaterThan(240);

  const cubeSatPixels = await page.evaluate(async () => {
    const canvas = document.querySelector("#cubesat-canvas canvas") as HTMLCanvasElement | null;
    if (!canvas) return 0;
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const probe = document.createElement("canvas");
    probe.width = Math.min(240, canvas.width);
    probe.height = Math.min(180, canvas.height);
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if (a > 20 && r + g + b > 35) count += 1;
    }
    return count;
  });
  expect(cubeSatPixels).toBeGreaterThan(250);

  const globePixels = await page.evaluate(async () => {
    const canvas = document.querySelector(".globe-canvas") as HTMLCanvasElement | null;
    if (!canvas) return 0;
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return canvas.toDataURL("image/png").length;
  });
  expect(globePixels).toBeGreaterThan(1000);

  const orbitPixels = await page.evaluate(async () => {
    const canvas = document.querySelector(".orbit-track-canvas") as HTMLCanvasElement | null;
    if (!canvas) return 0;
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    return canvas.toDataURL("image/png").length;
  });
  expect(orbitPixels).toBeGreaterThan(1000);

  await page.screenshot({ path: testInfo.outputPath("aegis-demo.png"), fullPage: true });
});
