import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { itkParameters } from './settings-browser.js';

export const itkScenarios = {
  marmande: itkParameters,
  'tomate-plein-champ': { ...itkParameters, variety: 'Cœur de bœuf', cover: 'plein', area: '1', year: '2026', soil: 'leger' },
  laitue: { ...itkParameters, crop: 'laitue', variety: 'Feuille de chêne', month: '11' },
  carotte: { ...itkParameters, crop: 'carotte', variety: 'Carotte de conservation', cover: 'plein', area: '100000', month: '1', year: '2033', soil: 'lourd', water: 'limitee' },
  courgette: { ...itkParameters, crop: 'courgette', variety: 'Ronde de Nice', area: '375', month: '4' },
};

export async function readItkResult(page) {
  return page.locator('#itk-output').evaluate(panel => ({
    culture: panel.querySelector('h2').textContent.trim(),
    conditions: [...panel.querySelectorAll('.itk-culture-summary dd')].map(item => item.textContent.trim()),
    metrics: [...panel.querySelectorAll('.metric strong')].map(item => item.textContent),
    warnings: [...panel.querySelectorAll('.warning-block li')].map(item => item.textContent),
    timeline: [...panel.querySelectorAll('.timeline-entry')].map(entry => ({
      period: entry.querySelector('.itk-month').textContent.trim(),
      offset: entry.querySelector('.timeline-date span').textContent,
      operation: entry.querySelector('.timeline-content h4').textContent,
      description: entry.querySelector('.timeline-content p').textContent,
    })),
    reference: panel.querySelector('.subtle-explainer').textContent.trim().replace(/\s+/g, ' '),
    notice: panel.querySelector('.result-disclaimer').textContent.trim(),
  }));
}

export async function downloadItkCsv(page) {
  const pending = page.waitForEvent('download');
  await page.locator('#csv-export').click();
  const download = await pending;
  const bytes = await readFile(await download.path());
  return {
    name: download.suggestedFilename(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes,
  };
}
