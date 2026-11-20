import { expect } from '@playwright/test';

export async function courseQuizAction(page, action, ...args) {
  return page.evaluate(async ({ action, args }) => {
    const app = new URL(document.querySelector('script[src*="assets/app.js"]').src);
    const url = new URL('./course-quiz-service.js', app);
    url.search = app.search;
    const service = await (await import(url.href)).getCourseQuizService();
    return service[action](...args);
  }, { action, args });
}

export async function refreshCourseQuiz(page) {
  await courseQuizAction(page, 'retry');
  await expect.poll(async () => (await courseQuizAction(page, 'getState')).sync.state).toBe('synced');
}
