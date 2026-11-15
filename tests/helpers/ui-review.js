import { expect } from '@playwright/test';
import { existsSync } from 'node:fs';

export async function capture(target, name, testInfo, extra = {}) {
  const options = { animations: 'disabled', caret: 'hide', ...extra };
  if (typeof target.goto === 'function' && !extra.clip) options.fullPage = true;
  // New images are review artifacts. Only a separately approved, committed
  // reference enables pixel regression assertions; this run approves nothing.
  if (existsSync(testInfo.snapshotPath(name))) await expect(target).toHaveScreenshot(name, options);
  const path = testInfo.outputPath(name);
  await target.screenshot({ ...options, path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

export async function textContrasts(target) {
  return target.evaluateAll(nodes => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value); };
    const blend = (front, back) => [...front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3])), 1];
    const light = value => value.slice(0, 3).map(channel => { const x = channel / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, x, index) => sum + x * [.2126, .7152, .0722][index], 0);
    return nodes.map(node => {
      const ancestors = []; for (let parent = node; parent; parent = parent.parentElement) ancestors.push(parent);
      let backgrounds = [[255, 255, 255, 1]];
      for (const parent of ancestors.reverse()) {
        const style = getComputedStyle(parent);
        backgrounds = backgrounds.map(background => blend(rgba(style.backgroundColor), background));
        const stops = style.backgroundImage.match(/rgba?\([^)]*\)/g);
        if (stops) backgrounds = backgrounds.flatMap(background => stops.map(stop => blend(rgba(stop), background)));
      }
      const ratios = backgrounds.map(background => {
        const text = blend(rgba(getComputedStyle(node).color), background);
        const values = [light(text), light(background)].sort((a, b) => b - a);
        return (values[0] + .05) / (values[1] + .05);
      });
      return { text: node.textContent.trim(), ratio: Math.min(...ratios), color: getComputedStyle(node).color, composedBackgrounds: backgrounds.map(value => value.slice(0, 3)) };
    });
  });
}
