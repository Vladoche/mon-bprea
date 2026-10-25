import { createScopedRepository } from './personal-idb.js';
import { emptyPersonalDocument, validatePersonalDocument, LocalCourseQuizError } from './course-quiz-model.js';
export { personalScope } from './drill-personal-store.js';
export { LocalCourseQuizError, clone } from './course-quiz-model.js';
export const PERSONAL_COURSE_QUIZ_DB = 'mon-bprea-course-quiz-personal-v1';
export function createCourseQuizRepository(scope, { indexedDB = globalThis.indexedDB,
  databaseName = PERSONAL_COURSE_QUIZ_DB, onCommit = () => {} } = {}) {
  return createScopedRepository(scope, { indexedDB, databaseName, onCommit,
    empty: emptyPersonalDocument, validate: validatePersonalDocument, ErrorType: LocalCourseQuizError });
}
