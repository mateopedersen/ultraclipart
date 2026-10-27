import { categorySubjects } from './category-directory';
import { newestArt } from './catalog';
import { latestSubjectCollections } from './collection-discovery';
import { fingerprint } from './cache-fingerprint';
export const latestCollections = latestSubjectCollections(categorySubjects, newestArt);
export const collectionFeed = { version: fingerprint(latestCollections), items: latestCollections };
