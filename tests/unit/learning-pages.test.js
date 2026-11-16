import { describe, it, expect } from 'vitest';
import { unitLessons, renderCourse } from '../../assets/learning-pages.js';

describe('navigation pédagogique UC', () => {
  const icon = () => '';
  const make = (id, unit, order) => ({ id, unit, order, title: id, chapter: 'Chapitre', summary: '', body: '', essentials: [], quiz: [], minutes: 2 });
  it('trie les seuls cours de l’UC sans muter la source ni franchir sa limite', () => {
    const list = [make('a-last', 'a', 3), make('other', 'b', 1), make('a-first', 'a', 1), make('a-middle', 'a', 2)];
    expect(unitLessons(list, 'a').map(l => l.id)).toEqual(['a-first', 'a-middle', 'a-last']);
    expect(list[0].id).toBe('a-last');
    const unit = { id: 'a', code: 'UC A' };
    expect(renderCourse(list[2], unit, list, icon)).toContain('class="next-lesson" href="cours.html?id=a-middle"');
    expect(renderCourse(list[0], unit, list, icon)).toContain('class="next-lesson" href="uc.html?id=a"');
    expect(renderCourse(list[0], unit, list, icon)).not.toContain('cours.html?id=other');
  });
});
