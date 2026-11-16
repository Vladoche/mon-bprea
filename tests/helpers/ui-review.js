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

/** Sample actual rendered backgrounds, including photographs behind glass.
 * Diagnostic text hiding is never used for the review captures themselves. */
export async function renderedTextContrasts(page, selector) {
  const target = page.locator(selector);
  const samples = await target.evaluate(root => {
    const clip = root.getBoundingClientRect();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), values = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('[hidden],[inert],.sr-only')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const rects = [...range.getClientRects()].map(r => ({
        x: Math.max(0, clip.left, r.left), y: Math.max(0, clip.top, r.top),
        right: Math.min(innerWidth, clip.right, r.right), bottom: Math.min(innerHeight, clip.bottom, r.bottom),
      })).filter(r => r.right > r.x && r.bottom > r.y);
      if (rects.length) values.push({ text: node.textContent.trim(), color: getComputedStyle(node.parentElement).color, rects });
    }
    root.classList.add('review-contrast-sample');
    return values;
  });
  const style = await page.addStyleTag({ content: '.review-contrast-sample,.review-contrast-sample *{color:transparent!important;text-shadow:none!important}' });
  let screenshot;
  try { screenshot = await page.screenshot({ animations: 'disabled' }); }
  finally { await style.evaluate(node => node.remove()); await target.evaluate(node => node.classList.remove('review-contrast-sample')); }
  return page.evaluate(async ({ samples, png }) => {
    const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
    const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = 1;
    const colors = colorCanvas.getContext('2d', { willReadFrequently: true });
    const light = rgb => rgb.map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return samples.map(sample => {
      colors.fillStyle = sample.color; colors.fillRect(0, 0, 1, 1);
      const foreground = light([...colors.getImageData(0, 0, 1, 1).data].slice(0, 3));
      let ratio = Infinity;
      for (const r of sample.rects) for (const dx of [.1, .5, .9]) for (const dy of [.2, .5, .8]) {
        const bg = light([...ctx.getImageData(Math.floor(r.x + (r.right - r.x) * dx), Math.floor(r.y + (r.bottom - r.y) * dy), 1, 1).data].slice(0, 3));
        ratio = Math.min(ratio, (Math.max(bg, foreground) + .05) / (Math.min(bg, foreground) + .05));
      }
      return { text: sample.text, ratio };
    });
  }, { samples, png: screenshot.toString('base64') });
}
