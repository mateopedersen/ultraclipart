import catalogTopics from '../../../data/topics.json';
import extraTopics from '../../../data/extra-topics.json';

/** Explicit semantic bindings take precedence over isolated catalog collection identities. */
export const TAXONOMY_VERSION = 'uc-subjects-4';
export interface Subject {
  id: string;
  topic: string;
  label: string;
  plural: string;
  domain: string;
  family: string;
  terms: string[];
}
const subjects: Subject[] = [];
function add(domain: string, family: string, rows: string) {
  for (const row of rows.trim().split('\n')) {
    const [topic, key, label, plural, aliases = ''] = row.split('|');
    subjects.push({
      id: `${domain}.${family}.${key}`,
      topic,
      label,
      plural,
      domain,
      family,
      terms: [label.toLowerCase(), ...aliases.split(',').filter(Boolean)],
    });
  }
}
add(
  'food',
  'fruit',
  `apple|apple|apple|apples|apples,apfel,elma,manzana,pomme
red-apple|apple.red|red apple|red apples
green-apple|apple.green|green apple|green apples
pineapple|pineapple|pineapple|pineapples|pineapples,ananas
kiwi-fruit|kiwi|kiwifruit|kiwifruit|kiwi fruit,kiwi fruits,kiwifruits
orange|orange|orange|oranges|oranges
banana|banana|banana|bananas|bananas
strawberry|strawberry|strawberry|strawberries|strawberries
raspberry|raspberry|raspberry|raspberries|raspberries
blueberry|blueberry|blueberry|blueberries|blueberries
blackberry|blackberry|blackberry|blackberries|blackberries
avocado|avocado|avocado|avocados|avocados
coconut|coconut|coconut|coconuts|coconuts
mandarin|mandarin|mandarin|mandarins|mandarins
tangerine|tangerine|tangerine|tangerines|tangerines
pear|pear|pear|pears|pears
peach|peach|peach|peaches|peaches
lemon|lemon|lemon|lemons|lemons
lime|lime|lime|limes|limes
grapefruit|grapefruit|grapefruit|grapefruit
mango|mango|mango|mangoes|mangoes,mangos
grapes|grape|grape|grapes|grapes
watermelon|watermelon|watermelon|watermelons|watermelons
melon|melon|melon|melons|melons
cantaloupe|cantaloupe|cantaloupe|cantaloupes|cantaloupes
papaya|papaya|papaya|papayas|papayas
plum|plum|plum|plums|plums
persimmon|persimmon|persimmon|persimmons|persimmons
guava|guava|guava|guavas|guavas
lychee|lychee|lychee|lychees|lychees
nectarine|nectarine|nectarine|nectarines|nectarines
dragon-fruit|dragon|dragon fruit|dragon fruit|pitaya
date|date|date fruit|dates|date palm,dates
pomegranate|pomegranate|pomegranate|pomegranates|pomegranates
blackcurrant|blackcurrant|blackcurrant|blackcurrants|blackcurrants
passion-fruit|passion|passion fruit|passion fruit
cranberry|cranberry|cranberry|cranberries|cranberries
apricot|apricot|apricot|apricots|apricots
fig|fig|fig|figs|figs`,
);
add(
  'animal',
  'mammal',
  `cat|cat|cat|cats|cats,kitten,kittens
dog|dog|dog|dogs|dogs,puppy,puppies
baby-elephant|elephant.young|baby elephant|baby elephants|elephant calf
elephant|elephant|elephant|elephants|elephants
bear|bear|bear|bears|bears
camel|camel|camel|camels|camels
cow|cow|cow|cows|cows
deer|deer|deer|deer|fawn
dolphin|dolphin|dolphin|dolphins|dolphins
fox|fox|fox|foxes|foxes
giraffe|giraffe|giraffe|giraffes|giraffes
goat|goat|goat|goats|goats
hedgehog|hedgehog|hedgehog|hedgehogs|hedgehogs
hippo|hippo|hippo|hippos|hippopotamus,hippos
horse|horse|horse|horses|horses,foal
kangaroo|kangaroo|kangaroo|kangaroos|kangaroos
koala|koala|koala|koalas|koalas
lamb|sheep.young|lamb|lambs|lambs
lion|lion|lion|lions|lions
monkey|monkey|monkey|monkeys|monkeys
panda|panda|panda|pandas|pandas
pig|pig|pig|pigs|pigs,piglet
rabbit|rabbit|rabbit|rabbits|rabbits,bunny,bunnies
raccoon|raccoon|raccoon|raccoons|raccoons
rhino|rhino|rhino|rhinos|rhinoceros,rhinos
sheep|sheep|sheep|sheep
squirrel|squirrel|squirrel|squirrels|squirrels
tiger|tiger|tiger|tigers|tigers
whale|whale|whale|whales|whales
wolf|wolf|wolf|wolves|wolves
zebra|zebra|zebra|zebras|zebras
bat|bat|bat|bats|bats
reindeer|reindeer|reindeer|reindeer`,
);
add(
  'animal',
  'bird',
  `kiwi|kiwi|kiwi bird|kiwi birds
chicken|chicken|chicken|chickens|chickens
duck|duck|duck|ducks|ducks,duckling
eagle|eagle|eagle|eagles|eagles,eaglet
flamingo|flamingo|flamingo|flamingos|flamingos
owl|owl|owl|owls|owls,owlet
parrot|parrot|parrot|parrots|parrots
peacock|peacock|peacock|peacocks|peacocks
penguin|penguin|penguin|penguins|penguins
turkey|turkey|turkey|turkeys|turkeys,poult
cardinal|cardinal|cardinal|cardinals|cardinals`,
);
add(
  'animal',
  'other',
  `bee|bee|bee|bees|bees
butterfly|butterfly|butterfly|butterflies|butterflies
crab|crab|crab|crabs|crabs
crocodile|crocodile|crocodile|crocodiles|crocodiles
frog|frog|frog|frogs|frogs
lobster|lobster|lobster|lobsters|lobsters
octopus|octopus|octopus|octopuses|octopuses
shark|shark|shark|sharks|sharks
snake|snake|snake|snakes|snakes
spider|spider|spider|spiders|spiders
turtle|turtle|turtle|turtles|turtles`,
);
add(
  'people',
  'person',
  `baby|baby|baby|babies|babies,newborn,infant
child|child|child|children|children
family|family|family|families|families`,
);
add(
  'sport',
  'equipment',
  `volleyball|volleyball|volleyball|volleyball designs
baseball-bat|baseball.bat|baseball bat|baseball bats
football|football|football|football designs`,
);
add(
  'object',
  'technology',
  `headphones|headphones|headphones|headphone designs|headset,headsets
television|television|television|televisions|televisions,tv
laptop|laptop|laptop|laptops|notebook computer,notebook computers,portable computer,portable computers
printer|printer|printer|printers|desktop printer,desktop printers,printing machine,printing machines
scanner|scanner|scanner|scanners|flatbed scanner,flatbed scanners,barcode scanner,barcode scanners,document scanner,document scanners
keyboard|keyboard|computer keyboard|computer keyboards|keyboard,keyboards,typing keyboard,typing keyboards
apple-logo|apple.brand|apple logo|Apple logo designs|iphone,macbook`,
);
add(
  'object',
  'jewelry',
  `ring|ring|jewelry ring|jewelry rings|engagement ring,wedding ring,diamond ring`,
);
add('object', 'symbol', `heart|heart|heart|hearts|hearts`);
add(
  'food',
  'vegetable',
  `pumpkin|pumpkin|pumpkin|pumpkins|pumpkins,jack o lantern
corn|corn|corn|corn designs`,
);
add(
  'seasonal',
  'motif',
  `ghost|ghost|ghost|ghosts|ghosts
witch|witch|witch|witches|witches
skeleton|skeleton|skeleton|skeletons|skeletons
vampire|vampire|vampire|vampires|vampires
snowman|snowman|snowman|snowmen|snowmen
snowflake|snowflake|snowflake|snowflakes|snowflakes
santa|santa|Santa|Santa designs|santa claus
holly|holly|holly|holly designs
acorn|acorn|acorn|acorns|acorns
leaves|leaves|leaves|leaf designs|leaf
gift|gift|gift|gifts|gifts,presents
christmas-tree|christmas.tree|Christmas tree|Christmas trees`,
);

export const SUBJECTS = subjects;
export const BY_TOPIC = new Map(subjects.map((s) => [s.topic, s]));
export const BY_ID = new Map(subjects.map((s) => [s.id, s]));
export const THEME_COLLECTIONS = new Set([
  'winter',
  'halloween',
  'thanksgiving',
  'christmas',
  'autumn',
  'fall',
]);
/** New approved catalog topics get their own identity, never a guessed shared family.
 * Keep them out of the title classifier: a decorative mention must not become a
 * primary subject on another collection. Broad themes retain contextual classification.
 */
export const REGISTERED_TOPICS = new Set(
  [...catalogTopics.topics, ...extraTopics].map((topic) => topic.slug),
);
export const CATALOG_SUBJECTS = new Map<string, Subject>(
  [...catalogTopics.topics, ...extraTopics]
    .filter((topic) => !BY_TOPIC.has(topic.slug) && !THEME_COLLECTIONS.has(topic.slug))
    .map((topic) => {
      const label = topic.keyword.replace(/\s+clipart$/i, '').trim();
      return [
        topic.slug,
        {
          id: `catalog.topic.${topic.slug}`,
          topic: topic.slug,
          label,
          plural: `${label.toLowerCase()} designs`,
          domain: 'catalog',
          family: topic.slug,
          terms: [...new Set([words(label), words(topic.slug)])],
        },
      ];
    }),
);
export function words(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const termIndex = subjects
  .flatMap((s) => s.terms.map((term) => ({ term, subject: s })))
  .sort((a, b) => b.term.length - a.term.length);
export function mentions(value: string): { subject: Subject; position: number }[] {
  const text = ` ${words(value)} `;
  const occupied: [number, number][] = [];
  const found = new Map<string, { subject: Subject; position: number }>();
  for (const { term, subject } of termIndex) {
    const at = text.indexOf(` ${term} `);
    if (at < 0 || occupied.some(([a, b]) => at >= a && at < b)) continue;
    // These words have common non-subject meanings; demand their specific context.
    if (
      subject.topic === 'orange' &&
      !/\b(oranges|fruit|citrus|rind|peel|segments?|slice|juice|sweet orange)\b/.test(text)
    )
      continue;
    if (
      subject.topic === 'keyboard' &&
      /\b(piano|organ|synthesizer|synth|musical|music|instrument|keytar)\b/.test(text) &&
      !/\b(computer|desktop|laptop|gaming|typing|usb|mechanical|ergonomic)\b/.test(text)
    )
      continue;
    if (subject.topic === 'turkey' && /\b(country|map|flag|istanbul|ankara|turkiye)\b/.test(text))
      continue;
    if (
      subject.topic === 'baby' &&
      /\bbaby (?:elephant|bear|cat|dog|fox|bird|kiwi|panda|rabbit|lion|tiger|monkey)\b/.test(text)
    )
      continue;
    occupied.push([at, at + term.length + 1]);
    found.set(subject.id, { subject, position: at });
  }
  const matches = [...found.values()];
  // A young animal may have a breed/adjective between "baby" and its species name.
  return matches
    .filter(
      (match) =>
        match.subject.topic !== 'baby' ||
        !matches.some(
          (other) =>
            other.subject.domain === 'animal' &&
            other.position > match.position &&
            other.position - match.position < 35,
        ),
    )
    .sort((a, b) => a.position - b.position || a.subject.id.localeCompare(b.subject.id));
}

/** Explicit, narrow companion policy. Family membership alone never grants eligibility. */
const fruitPartners: Record<string, string[]> = {
  apple: ['pear', 'orange', 'peach', 'plum'],
  orange: ['apple', 'lemon', 'lime', 'grapefruit', 'mandarin', 'tangerine'],
  pear: ['apple', 'peach', 'plum'],
  peach: ['apple', 'pear', 'nectarine', 'apricot'],
  plum: ['apple', 'pear', 'apricot'],
  lemon: ['orange', 'lime', 'grapefruit'],
  lime: ['orange', 'lemon', 'grapefruit'],
  grapefruit: ['orange', 'lemon', 'lime'],
  mandarin: ['orange', 'tangerine'],
  tangerine: ['orange', 'mandarin'],
  strawberry: ['raspberry', 'blueberry', 'blackberry'],
  raspberry: ['strawberry', 'blueberry', 'blackberry'],
  blueberry: ['raspberry', 'strawberry', 'blackberry'],
  blackberry: ['raspberry', 'strawberry', 'blueberry'],
  banana: ['coconut', 'kiwi-fruit'],
  coconut: ['banana', 'pineapple'],
  'kiwi-fruit': ['banana', 'strawberry'],
  pineapple: ['coconut', 'mango'],
};
export function companionSubjects(subject: Subject) {
  return (fruitPartners[subject.topic] ?? []).map((t) => BY_TOPIC.get(t)!).filter(Boolean);
}
