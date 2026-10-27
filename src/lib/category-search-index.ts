import { createHash } from 'node:crypto';
import { categorySubjects } from './category-directory';

export const categorySearchIndex = {
  version: 1,
  subjects: categorySubjects.map((subject) => ({
    id: subject.slug,
    name: subject.name,
    groups: subject.groups.join(' '),
    keywords: subject.searchKeywords,
  })),
};
export const categorySearchJson = JSON.stringify(categorySearchIndex);
export const categorySearchVersion = createHash('sha256').update(categorySearchJson).digest('hex');
export const categorySearchUrl = `/category-search/${categorySearchVersion}.json`;
