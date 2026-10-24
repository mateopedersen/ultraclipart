import { collectionCopy } from './fruit-collection-copy.mjs';

export const fiveContexts = {
  starfruit: [
    'A little star for your next page.',
    'Explore whole starfruit, cross-cut star slices and bright fruit characters for personal recipe cards, summer notes and classroom shape activities. The five-pointed slices work especially well as small accents.',
    'pineapple,dragon-fruit,guava',
  ],
  mulberry: [
    'Berry clusters with a lively touch.',
    'Find whole mulberries, cut fruit, leafy branches and playful characters for personal harvest pages and classroom berry comparisons. Let the clustered shape stay large enough to read clearly.',
    'blackberry,blackcurrant,raspberry',
  ],
  kumquat: [
    'Small citrus with a warm glow.',
    'Choose whole kumquats, sliced citrus and friendly fruit characters for personal food journals and classroom citrus cards. Pair the small oval fruit with larger oranges or limes to compare shapes and scale.',
    'orange,tangerine,lime',
  ],
  quince: [
    'An orchard detail with character.',
    'Explore whole quinces, cut fruit, leafy branches and cheerful characters for personal autumn recipe pages and classroom orchard activities. The golden fruit adds a distinct shape beside pears and apples.',
    'pear,apple,persimmon',
  ],
  gooseberry: [
    'Small berries, plenty of detail.',
    'Pick gooseberry clusters, cut berries, leaves and fruit characters for personal garden journals and classroom berry activities. Enlarged cut fruit helps show the inner detail clearly.',
    'blackcurrant,cranberry,grapes',
  ],
};
export const fiveCopy = (topic, items) => collectionCopy(topic, items, fiveContexts[topic]);
