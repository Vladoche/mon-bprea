import { expect } from '@playwright/test';

export async function preparePaintCapture(page, { date = null, throttle = true } = {}) {
  await page.setViewportSize({ width: 900, height: 580 });
  await page.addInitScript(time => {
    // Freeze calendar time only. Paint and CDP timestamps need the real clock.
    const BrowserDate = Date;
    function FixedDate(...args) {
      if (!new.target) return new BrowserDate(time).toString();
      return Reflect.construct(BrowserDate, args.length ? args : [time], new.target);
    }
    Object.setPrototypeOf(FixedDate, BrowserDate);
    FixedDate.prototype = BrowserDate.prototype;
    FixedDate.now = () => time;
    if (time !== null) window.Date = FixedDate;
    new PerformanceObserver(list => {
      const paint = list.getEntries().find(item => item.name === 'first-paint');
      if (paint) window.firstPaintEpoch = (performance.timeOrigin + paint.startTime) / 1000;
    }).observe({ type: 'paint', buffered: true });
  }, date && +date);
  const client = await page.context().newCDPSession(page);
  if (throttle) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 600000, uploadThroughput: 240000 });
  }
  return client;
}

export async function pixels(page, images) {
  return page.evaluate(async images => {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return Promise.all(images.map(async data => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.fromBase64(data)]));
      // The outer margin at (4,85) is the page background in this viewport.
      ctx.drawImage(bitmap, 4, 85, 1, 1, 0, 0, 1, 1);
      bitmap.close();
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    }));
  }, images);
}

function expectBrightness(rgb, mode, label) {
  const description = label + ' rgb(' + rgb.join(', ') + ')';
  if (mode === 'dark') expect(Math.max(...rgb), description).toBeLessThan(85);
  else expect(Math.min(...rgb), description).toBeGreaterThan(185);
}

export async function recordNavigation(page, client, testInfo, { name, mode, expectedPixel, navigate, whileVisible, bfcache = false, attachFrame = true }) {
  const frames = [];
  const listener = ({ data, metadata, sessionId }) => {
    frames.push({ data, time: metadata.timestamp });
    void client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  client.on('Page.screencastFrame', listener);
  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  let firstPaint;
  let visible;
  try {
    const start = Date.now() / 1000;
    await navigate();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (bfcache) firstPaint = start;
    else {
      await expect.poll(() => page.evaluate(() => window.firstPaintEpoch)).toBeGreaterThan(start);
      firstPaint = await page.evaluate(() => window.firstPaintEpoch);
    }
    visible = (await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data;
    await whileVisible?.();
  } finally {
    await client.send('Page.stopScreencast');
    client.off('Page.screencastFrame', listener);
  }
  const afterPaint = frames.filter(frame => frame.time >= firstPaint);
  expect(afterPaint.length, 'images du compositeur après première peinture · ' + name).toBeGreaterThan(0);
  const samples = await pixels(page, [visible, ...afterPaint.map(frame => frame.data)]);
  for (const [index, rgb] of samples.entries()) expectBrightness(rgb, mode, name + ' / image ' + index);
  if (attachFrame) await testInfo.attach(name + '-premiere-frame', { body: Buffer.from(afterPaint[0].data, 'base64'), contentType: 'image/png' });
  await testInfo.attach(name + '-pixels', { body: JSON.stringify(samples), contentType: 'application/json' });
  if (expectedPixel) {
    const reference = typeof expectedPixel === 'function' ? await expectedPixel() : expectedPixel;
    for (const [index, rgb] of samples.entries()) {
      expect(rgb, name + ' / image ' + index).toEqual(reference);
    }
  }
}

export async function backgroundPixel(page, client) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  return (await pixels(page, [data]))[0];
}
