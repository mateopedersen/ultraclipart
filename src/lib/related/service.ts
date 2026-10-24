import { art } from '../catalog';
import { RelatedIndex } from './engine';
import type { ArtworkInput } from './normalize';
// Astro imports this once per build. Changes to the catalog enter the same normalization path.
export const relatedIndex = new RelatedIndex(art as ArtworkInput[]);
