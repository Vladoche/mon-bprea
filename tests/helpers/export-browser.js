// Test-only isolation of the readonly invariant. Production export does NOT
// stop synchronization: concurrent activity is detected by its bounded passes.
export async function stopOrdinarySync(page) {
  await page.evaluate(async () => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    for (const [file, getter] of [['settings-service.js', 'getSettingsService'], ['course-quiz-service.js', 'getCourseQuizService']]) {
      const url = new URL(`./${file}`, app); url.search = app.search;
      (await (await import(url.href))[getter]()).stop();
    }
  });
}
