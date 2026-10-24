import { art } from './catalog';
import { buildCuteIndex } from './cute-discovery';
export const cuteSurpriseIndex = buildCuteIndex(
  art,
  512,
  import.meta.env.PUBLIC_RELEASE_REVISION || 'local',
);
if (!cuteSurpriseIndex.length)
  throw new Error('Surprise me needs at least one published cute artwork.');
