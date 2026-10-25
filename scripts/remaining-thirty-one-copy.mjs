import contexts from './remaining-thirty-one-contexts.json' with { type: 'json' };
import reviewedCaptions from './remaining-thirty-one-captions.json' with { type: 'json' };
import productReviews from './remaining-product-identities.json' with { type: 'json' };
import { reviewedProductMetadata } from './product-identity.mjs';
export const packageContexts = contexts;
// Reviewed from the actual artwork, rather than treating a word such as
// "happy" in a greeting or "baby" in a product name as proof of a cute image.
const smileSelections = new Set([
  'moon-clipart-sleeping-crescent-face',
  'candy-clipart-gummy-bears',
  'mom-clipart-mother-baby-rocking',
  'mom-clipart-mother-toddler-bubbles',
]);
export const packageDiscovery = (id) => ({ cute: smileSelections.has(id) });
const small = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);
const proper = {
  iphone: 'iPhone',
  samsung: 'Samsung',
  tesla: 'Tesla',
  galaxy: 'Galaxy',
  ssd: 'SSD',
  tv: 'TV',
  nyc: 'NYC',
  nypl: 'New York Public Library',
  la: 'Los Angeles',
  '3d': '3D',
  cmyk: 'CMYK',
  se: 'SE',
  elysee: 'Élysée',
  luneville: 'Lunéville',
  sevres: 'Sèvres',
  porron: 'Porrón',
  gaudi: 'Gaudí',
  quixote: 'Quixote',
  gull: 'Gull',
};
export function readable(text) {
  return text
    .replace(/-lineart\b/g, '-line-art')
    .replace(/-stilllife\b/g, '-still-life')
    .split('-')
    .map(
      (word, i) =>
        proper[word] ?? (i && small.has(word) ? word : word[0].toUpperCase() + word.slice(1)),
    )
    .join(' ');
}
const exact = {
  ...reviewedCaptions,
  'new-york-clipart-new-york-nypl-lion': [
    'New York Public Library Lion Statue',
    'An illustrated pale stone lion resting on a rectangular pedestal, inspired by the New York Public Library statues.',
  ],
  'new-york-clipart-new-york-nyc-street-corner': [
    'New York City Street Corner',
    'A street-corner illustration with a New York City theme.',
  ],
  'moon-clipart-sleeping-crescent-face': [
    'Smiling Golden Crescent Moon with Closed Eyes',
    'A golden crescent moon with closed eyes, a small smile and stars painted across its face.',
  ],
  'candy-clipart-gummy-bears': [
    'Three Colorful Gummy Bears',
    'Three glossy red, amber and green gummy bears standing together.',
  ],
  'mom-clipart-mother-baby-rocking': [
    'Mother Cradling a Sleeping Baby in a Rocking Chair',
    'A smiling mother sits in a wooden rocking chair, cradling a sleeping baby wrapped in a blanket.',
  ],
  'mom-clipart-mother-toddler-bubbles': [
    'Mother and Toddler Playing with Soap Bubbles',
    'A mother blows soap bubbles while her toddler reaches up to catch them.',
  ],
  'mom-clipart-mother-newborn-hand-detail': [
    'Mother’s Hands Holding Newborn Feet',
    'A pair of newborn feet cradled in an adult’s hands.',
  ],
  'clock-clipart-candle-clock': [
    'Lit Candle in a Brass Holder',
    'A lit candle standing in a brass holder, with wax running down its sides.',
  ],
  'clock-clipart-hourglass-pendant-clock': [
    'Hourglass Pendant',
    'A small hourglass suspended as a decorative pendant.',
  ],
  'moon-clipart-lunar-calendar-outline': [
    'Ornate Table Mirror with Moon Outline',
    'An outline drawing of an ornate standing mirror with a moon inside its frame.',
  ],
  'moon-clipart-moon-cloud-rain-outline': [
    'Crescent Moon, Cloud and Hanging Stars Outline',
    'A crescent moon beside a cloud, with small stars hanging beneath them in an outline drawing.',
  ],
  'moon-clipart-thin-waxing-crescent': [
    'Waxing Crescent Moon',
    'A cratered crescent moon with a bright curved edge and a shaded inner portion.',
  ],
  'miami-clipart-miami-surfboard-stand': [
    'Miami Lifeguard Stand with Surfboards',
    'A beach lifeguard stand with surfboards alongside it, illustrated as a Miami coastal scene.',
  ],
  'shoe-clipart-shoe-on-shoebox-outline': [
    'Trainers in an Open Shoebox Outline',
    'An outline drawing of trainers resting inside an open shoebox.',
  ],
  'exercise-clipart-woman-battle-ropes': [
    'Man Training with Battle Ropes',
    'A man holding two heavy exercise ropes during a battle-rope workout.',
  ],
  'exercise-clipart-man-rowing-machine': [
    'Older Adult Using a Rowing Machine',
    'An older adult seated on a rowing machine, holding the pull handle.',
  ],
  'exercise-clipart-woman-medicine-ball-slam': [
    'Medicine Ball Slam',
    'A person using a weighted medicine ball during a standing exercise.',
  ],
  'thank-you-clipart-floral-gratitude-monogram-free': [
    'Thank You with Roses',
    'The words Thank You surrounded by decorative roses and foliage.',
  ],
  'tesla-clipart-battery-factory-installation': [
    'Tesla-inspired Electric Car Chassis on an Assembly Line',
    'A Tesla-inspired electric car chassis surrounded by robotic equipment on an illustrated assembly line.',
  ],
  'tesla-clipart-roadster-performance-ano-white-grounded': [
    'White Tesla-inspired Roadster Concept',
    'A white sports car in an imagined Tesla-inspired Roadster concept illustration.',
  ],
  'mars-clipart-mars-crescent-outline': [
    'Cratered Crescent Fantasy (Mars Theme)',
    'A decorative cratered crescent in a Mars-themed outline drawing.',
  ],
  'mars-clipart-mars-two-moon-orbits-outline': [
    'Planet and Two Moons Fantasy Outline (Mars Theme)',
    'A decorative outline composition of a cratered planet with two small moons and curved orbital lines.',
  ],
  'france-clipart-french-bordeaux-gateway': [
    'Bordeaux-inspired Gateway Illustration',
    'An ornate castle-like gateway in a decorative illustration inspired by Bordeaux.',
  ],
  'candy-clipart-conversation-heart': [
    'Pastel Heart Candies',
    'An assortment of small heart-shaped sweets in pastel colors, without lettering.',
  ],
  'candy-clipart-pez-style-tablets': [
    'Pastel Candy Tablets',
    'Small rectangular candy tablets scattered together in soft pastel colors.',
  ],
  'american-flag-clipart-american-flag-flat-rectangle': [
    'Flat American Flag',
    'A flat United States flag with a blue canton, white stars and red-and-white stripes.',
  ],
  'france-flag-clipart-official-flat-tricolor': [
    'Flat French Tricolor Flag',
    'The French flag in a flat rectangle with blue, white and red vertical bands.',
  ],
  'spain-flag-clipart-official-flat-banner': [
    'Flat Spanish Flag',
    'A rectangular Spanish flag with red and yellow horizontal bands and an illustrated coat of arms.',
  ],
  'mexico-flag-clipart-flat-official-tricolor': [
    'Flat Mexican Tricolor Flag',
    'The Mexican flag with green, white and red vertical bands and an illustrated central emblem.',
  ],
  'clock-clipart-water-clock-clepsydra': [
    'Water Clock (Clepsydra)',
    'A decorative water clock illustration showing an older method of measuring the passage of time.',
  ],
  'math-clipart-mobius-strip': [
    'Möbius Strip',
    'An illustrated loop with a twist, representing a Möbius strip.',
  ],
  'exercise-clipart-wheelchair-dumbbell-training': [
    'Wheelchair User Training with Dumbbells',
    'A wheelchair user holding dumbbells during a seated exercise activity.',
  ],
  'mom-clipart-mother-wheelchair-picnic': [
    'Mother Using a Wheelchair at a Picnic',
    'A mother using a wheelchair spending time with her child at a picnic.',
  ],
};
const actionSubjects = {
  tesla: {
    'charge-plug-insertion-outline': 'Charging a Tesla-inspired Electric Car Outline',
    'cybercab-pedestrian-yield': 'Tesla-inspired Cybercab Pausing for a Pedestrian',
    'cybertruck-angular-front': 'Tesla-inspired Cybertruck Front View',
    'cybertruck-bed-power-tools': 'Tesla-inspired Cybertruck with Power Tools in Its Bed',
    'cybertruck-boat-towing': 'Tesla-inspired Cybertruck Towing a Boat',
    'cybertruck-exploded-body-chassis': 'Tesla-inspired Cybertruck Body and Chassis Concept',
    'cybertruck-water-crossing': 'Tesla-inspired Cybertruck Driving through Water',
    'cybertruck-wheel-alignment-outline': 'Tesla-inspired Cybertruck Wheel Alignment Outline',
    'first-roadster-open-top': 'First-generation Tesla-inspired Roadster with Open Roof',
    'key-card-door-access': 'Using a Key Card to Open a Tesla-inspired Car',
    'megapack-utility-storage': 'Tesla-inspired Megapack Energy Storage Units',
    'model-s-front-quarter': 'Tesla-inspired Model S Front Three-quarter View',
    'model-three-cabin-filter-service-outline':
      'Replacing a Tesla-inspired Model 3 Cabin Filter Outline',
    'model-three-side-profile': 'Tesla-inspired Model 3 Side View',
    'model-x-falcon-doors': 'Tesla-inspired Model X with Falcon-wing Doors',
    'model-y-camping-kitchen': 'Tesla-inspired Model Y with a Camping Kitchen',
    'model-y-dog-ramp': 'Tesla-inspired Model Y with a Dog Ramp',
    'model-y-rear-quarter': 'Tesla-inspired Model Y Rear Three-quarter View',
    'model-y-surf-trip': 'Tesla-inspired Model Y on a Surf Trip',
    'optimus-parcel-sorting': 'Tesla-inspired Optimus Robot Sorting Parcels',
    'panoramic-roof-stargazing-outline':
      'Stargazing through a Tesla-inspired Panoramic Roof Outline',
    'powerwall-installation': 'Tesla-inspired Powerwall Installation',
    'roadster-active-wing-outline':
      'Tesla-inspired Roadster with an Active Rear Wing Concept Outline',
    'roadster-airflow-test': 'Tesla-inspired Roadster Airflow Study Concept',
    'roadster-body-shell-outline': 'Tesla-inspired Roadster Body Shell Concept Outline',
    'roadster-cold-gas-nozzle-cutaway-outline':
      'Tesla-inspired Roadster Cold-gas Nozzle Concept Cutaway Outline',
    'roadster-concept-sportscar': 'Tesla-inspired Roadster Sports Car Concept',
    'roadster-gold-door-hinge': 'Tesla-inspired Roadster with a Gold Door Hinge Concept',
    'roadster-performance-exploded-assemblies':
      'Tesla-inspired Roadster Exploded Assemblies Concept',
    'roadster-rocket-flight-module-workbench':
      'Tesla-inspired Roadster Rocket Module on a Workbench Concept',
    'roadster-rocket-single-seat-cockpit':
      'Tesla-inspired Roadster Single-seat Rocket Cockpit Concept',
    'roadster-rocket-vertical-liftoff': 'Tesla-inspired Roadster Vertical Launch Concept',
    'roadster-roof-panel-storage': 'Tesla-inspired Roadster Roof Panel Storage Concept',
    'roadster-thrust-rear-four-nozzles': 'Tesla-inspired Roadster with Four Rear Thrusters Concept',
    'roadster-thrust-rear-system-cutaway':
      'Tesla-inspired Roadster Rear Thrust System Concept Cutaway',
    'roadster-wheel-balancing': 'Tesla-inspired Roadster Wheel Balancing Concept',
    'robovan-luggage-boarding': 'Loading Luggage into a Tesla-inspired Robovan',
    'semi-central-driving-cabin': 'Tesla-inspired Semi with a Central Driving Cabin',
    'semi-electric-truck-exploded-assemblies': 'Tesla-inspired Semi Exploded Assemblies Concept',
    'semi-loading-dock-outline': 'Tesla-inspired Semi at a Loading Dock Outline',
    'semi-long-range-trailer': 'Tesla-inspired Semi with a Trailer',
    'semi-megacharger-connected': 'Tesla-inspired Semi Connected to a Megacharger',
    'semi-wheel-brake-service-outline': 'Tesla-inspired Semi Wheel and Brake Service Outline',
    'solar-roof-tile-layers': 'Layers of Tesla-inspired Solar Roof Tiles',
    'supercharger-rest-stop-outline': 'Tesla-inspired Supercharger Rest Stop Outline',
    'tesla-powerwall-solar-home': 'Home with a Tesla-inspired Powerwall and Solar Panels',
    'tesla-semi-cab': 'Tesla-inspired Semi Truck Cab',
    'tesla-supercharger-pedestal': 'Tesla-inspired Supercharger Pedestal',
  },
  exercise: {
    'bench-and-barbell-outline': 'Weight Bench and Barbell Outline',
    'dumbbells-water-bottle': 'Dumbbells beside a Water Bottle',
    'exercise-ball-crunch-outline': 'Abdominal Crunch on an Exercise Ball Outline',
    'exercise-stair-stepper-outline': 'Stair Stepper Exercise Machine Outline',
    'hand-grip-exerciser-outline': 'Hand-grip Exercise Tool Outline',
    'jump-rope-timer': 'Skipping Rope with a Timer',
    'man-ab-wheel-rollout': 'Man Using an Ab Wheel',
    'man-barbell-deadlift': 'Man Performing a Barbell Deadlift',
    'man-bodyweight-squat': 'Man Performing a Bodyweight Squat',
    'man-calf-stretch': 'Man Stretching His Calf',
    'man-dumbbell-shoulder-press': 'Man Performing a Dumbbell Shoulder Press',
    'man-farmer-carry': 'Man Carrying Weights in a Farmer’s Walk',
    'man-hamstring-stretch': 'Man Stretching His Hamstring',
    'man-heavy-bag-jab': 'Man Throwing a Jab at a Punching Bag',
    'man-lunge-forward': 'Man Performing a Forward Lunge',
    'man-medicine-ball-twist': 'Man Twisting with a Medicine Ball',
    'man-pull-up-bar': 'Man Doing a Pull-up',
    'man-push-up': 'Man Doing a Push-up',
    'man-ski-ergometer': 'Man Using a Ski Ergometer',
    'man-treadmill-walk': 'Man Walking on a Treadmill',
    'man-triceps-dip': 'Man Performing a Triceps Dip',
    'older-man-agility-ladder': 'Older Man Training with an Agility Ladder',
    'older-man-breathing-drill': 'Older Man Practicing a Breathing Exercise',
    'resistance-band-kit': 'Resistance Band Exercise Kit',
    'rolled-yoga-mat-blocks': 'Rolled Yoga Mat with Exercise Blocks',
    'runner-mid-stride': 'Runner in Mid-stride',
    'seated-ankle-mobility-outline': 'Seated Ankle Mobility Exercise Outline',
    'senior-chair-stretch': 'Older Adult Stretching beside a Chair',
    'senior-walking-poles': 'Older Adult Walking with Poles',
    'standing-quad-stretch-outline': 'Standing Quadriceps Stretch Outline',
    'woman-balance-board': 'Woman Standing on a Balance Board',
    'woman-bird-dog-exercise': 'Woman Performing a Bird-dog Exercise',
    'woman-dance-fitness': 'Woman Taking Part in Dance Fitness',
    'woman-dumbbell-curl': 'Woman Performing a Dumbbell Curl',
    'woman-elliptical-trainer': 'Woman Using an Elliptical Trainer',
    'woman-hula-hoop': 'Woman Exercising with a Hula Hoop',
    'woman-jump-rope': 'Woman Skipping Rope',
    'woman-kettlebell-swing': 'Woman Performing a Kettlebell Swing',
    'woman-pilates-ball': 'Woman Exercising with a Pilates Ball',
    'woman-resistance-band-row': 'Woman Performing a Resistance Band Row',
    'woman-stationary-bike': 'Woman Riding a Stationary Exercise Bike',
    'woman-step-aerobics': 'Woman Doing Step Aerobics',
    'woman-swimming-freestyle': 'Woman Swimming Freestyle',
    'woman-weighted-sled-push': 'Woman Pushing a Weighted Exercise Sled',
    'woman-yoga-tree': 'Woman Practicing Tree Pose',
    'yoga-warrior-outline': 'Warrior Yoga Pose Outline',
  },
};
const motherSubjects = {
  'mother-adult-daughter-graduation': 'Mother at Her Adult Daughter’s Graduation',
  'mother-adult-son-reunion': 'Mother Reuniting with Her Adult Son',
  'mother-baby-carrier-outline': 'Mother Carrying a Baby in a Front Carrier Outline',
  'mother-baby-gentle-stretch': 'Mother and Baby Sharing a Gentle Stretch',
  'mother-baby-rocking': 'Mother Rocking a Baby',
  'mother-child-beach-shells': 'Mother and Child Collecting Shells on the Beach',
  'mother-child-dance-silhouette': 'Mother and Child Dancing Silhouette',
  'mother-child-flower-crown': 'Mother and Child Making a Flower Crown',
  'mother-child-heart-profile-outline': 'Mother and Child in a Heart Outline',
  'mother-child-kitchen-garden-outline': 'Mother and Child Tending a Kitchen Garden Outline',
  'mother-child-lunchbox': 'Mother Preparing a Lunchbox with Her Child',
  'mother-child-mending-teddy': 'Mother and Child Mending a Teddy Bear',
  'mother-child-paper-garland': 'Mother and Child Making a Paper Garland',
  'mother-child-pottery': 'Mother and Child Making Pottery',
  'mother-child-puzzle': 'Mother and Child Working on a Puzzle',
  'mother-child-race-finish': 'Mother and Child at a Race Finish',
  'mother-child-scooter-repair': 'Mother and Child Repairing a Scooter',
  'mother-child-star-project-outline': 'Mother and Child Making a Star Project Outline',
  'mother-child-tulip-gift-outline': 'Child Giving a Tulip to Mom Outline',
  'mother-child-umbrella-rescue': 'Mother Sheltering Her Child with an Umbrella',
  'mother-child-winter-mittens': 'Mother Helping Her Child with Winter Mittens',
  'mother-daughter-birdhouse': 'Mother and Daughter Making a Birdhouse',
  'mother-daughter-braids': 'Mother Braiding Her Daughter’s Hair',
  'mother-daughter-market': 'Mother and Daughter at a Market',
  'mother-daughter-microscope': 'Mother and Daughter Using a Microscope',
  'mother-daughter-photo-album': 'Mother and Daughter Looking at a Photo Album',
  'mother-daughter-roller-skating': 'Mother and Daughter Roller Skating',
  'mother-daughter-tennis': 'Mother and Daughter Playing Tennis',
  'mother-daughter-tree-planting-outline': 'Mother and Daughter Planting a Tree Outline',
  'mother-heart-keepsake': 'Mother-themed Heart Keepsake',
  'mother-infant-hammock-chair-outline': 'Mother Holding an Infant in a Hanging Chair Outline',
  'mother-infant-wrap': 'Mother Carrying an Infant in a Wrap',
  'mother-kids-bedtime-shadow': 'Mother and Children Making Bedtime Shadows',
  'mother-son-cooking-soup': 'Mother and Son Making Soup',
  'mother-son-drawing-chalk': 'Mother and Son Drawing with Chalk',
  'mother-son-hiking': 'Mother and Son Hiking Together',
  'mother-son-library': 'Mother and Son Reading in a Library',
  'mother-son-music-keyboard': 'Mother and Son Playing a Keyboard',
  'mother-son-pumpkin-carving': 'Mother and Son Carving a Pumpkin',
  'mother-son-sewing': 'Mother and Son Sewing Together',
  'mother-teen-baking-bread': 'Mother and Teenager Baking Bread',
  'mother-teen-cycling-outline': 'Mother and Teenager Cycling Outline',
  'mother-teen-garden-harvest': 'Mother and Teenager Harvesting a Garden',
  'mother-toddler-bubbles': 'Mother and Toddler Playing with Bubbles',
  'mother-toddler-first-step': 'Mother Helping a Toddler Take a First Step',
  'mother-toddler-folding-towels': 'Mother and Toddler Folding Towels',
  'mother-twin-handholding-silhouette': 'Mother Holding Hands with Twins Silhouette',
  'mother-twins-mealtime': 'Mother and Twins at Mealtime',
  'mother-wheelchair-picnic': 'Mother Using a Wheelchair at a Picnic',
};
const rules = [
  [/^mother-adult-daughter-graduation$/, "Mother at Her Adult Daughter's Graduation"],
  [/^mother-adult-son-reunion$/, 'Mother Reuniting with Her Adult Son'],
  [/^mother-twin-handholding-silhouette$/, 'Mother Holding Hands with Twins Silhouette'],
  [/^mother-child-dance-silhouette$/, 'Mother and Child Dancing Silhouette'],
  [/^mother-baby-rocking$/, 'Mother Rocking a Baby'],
  [/^mother-infant-wrap$/, 'Mother Carrying an Infant in a Wrap'],
  [/^mother-toddler-first-step$/, 'Mother Helping a Toddler Take a First Step'],
  [/^mother-twins-mealtime$/, 'Mother and Twins at Mealtime'],
];
const concepts = /^(roadster-|cybertruck-exploded|semi-electric-truck-exploded)/;
function subjectFor(topic, body) {
  const c = contexts[topic];
  if (actionSubjects[topic]?.[body]) return actionSubjects[topic][body];
  if (topic === 'mom' && motherSubjects[body]) return motherSubjects[body];
  const rule = rules.find(([pattern]) => pattern.test(body));
  if (rule) return rule[1];
  let subject = readable(
    body.replace(/^official-flat-/, 'flat-').replace(/^flat-official-/, 'flat-'),
  );
  if (topic.endsWith('-flag')) {
    const flagName = {
      'american-flag': 'American Flag',
      'france-flag': 'French Flag',
      'spain-flag': 'Spanish Flag',
      'mexico-flag': 'Mexican Flag',
    }[topic];
    const scene = readable(
      body
        .replace(/^(?:american-)?flag-/, '')
        .replace(/^(?:official-flat|flat-official)-/, 'flat-'),
    );
    const article = flagName === 'American Flag' ? 'an' : 'a';
    subject = `${scene} with ${article} ${flagName}`;
  } else if (topic === 'mom') {
    subject = subject.replace(
      /^Mother (Child|Daughter|Son|Teen|Baby|Toddler|Infant|Kids)\b/,
      'Mother and $1',
    );
  } else if (topic === 'thank-you') {
    if (!/thank|gratitude/i.test(subject)) subject += ' Thank-You Design';
  } else if (topic === 'happy-birthday') {
    if (!/birthday/i.test(subject)) subject += ' Birthday Design';
  } else if (topic === 'tesla') {
    subject = subject.replace(/\bModel Three\b/g, 'Model 3');
    if (!subject.startsWith('Tesla')) subject = 'Tesla-inspired ' + subject;
    if (concepts.test(body) && !/\bConcept\b/.test(subject)) subject += ' Concept';
  } else if (topic === 'iphone') {
    subject = subject
      .replace(/\biPhone Five\b/g, 'iPhone 5')
      .replace(/\biPhone Four\b/g, 'iPhone 4');
  } else if (topic === 'samsung') {
    subject = subject.replace(/\bGalaxy S Seven\b/g, 'Galaxy S7');
    if (!/^(Samsung|Galaxy)/.test(subject)) subject = 'Samsung-inspired ' + subject;
  } else if (
    [
      'paris',
      'new-york',
      'chicago',
      'miami',
      'los-angeles',
      'france',
      'spain',
      'mars',
      'math',
    ].includes(topic)
  ) {
    if (!subject.toLowerCase().includes(c.label.toLowerCase())) subject += ` (${c.label})`;
  }
  return subject;
}
function captionFor(topic, body, subject, outline, mono) {
  const base = subject
    .replace(/\s*\((?:Paris|New York|Chicago|Miami|Los Angeles|France|Spain|Mars|Math)\)$/, '')
    .replace(/\s+(?:Outline|Line Art|Silhouette)$/i, '');
  // Sentence case keeps alt text readable while retaining place and product names.
  const names =
    /\b(?:United States|American|French|Spanish|Mexican|France|Spain|Mexico|Paris|New York|Chicago|Miami|Los Angeles|Mars|Arc de Triomphe|Statue of Liberty|Empire State Building|Chrysler Building|Central Park|Grand Central|One World Trade Center|Brooklyn|Broadway|Queens|Staten Island|Times Square|Washington|Rockefeller|Guggenheim|Radio City|Cloud Gate|Buckingham Fountain|Willis Tower|John Hancock Center|Navy Pier|Adler Planetarium|Field Museum|Jay Pritzker|Marina City|Picasso|Tribune Tower|Wrigley|Biscayne Bay|Little Havana|Freedom Tower|South Beach|South Pointe|Ocean Drive|Wynwood|Vizcaya|Angels Flight|Bradbury Building|Griffith|Hollywood Bowl|San Gabriel|Santa Monica|Venice|Walt Disney|Montmartre|Morris|Haussmann|Luxembourg|Moulin Rouge|Orsay|Palais Garnier|Pantheon|Place Vendome|Pont Alexandre|Seine|Wallace|Sacre Coeur|Tuileries|Bayeux|Breton|Camargue|Chambord|Carcassonne|Lyon|Marseille|Mont Blanc|Nice|Pont du Gard|Reims|Strasbourg|Lunéville|Marianne|Normandy|Savoy|Sèvres|Alhambra|Basque|Camino|Catalan|Cordoba|Don Quixote|Rocinante|Galician|Iberian|Royal Palace Madrid|Santiago|Segovia|Seville|Giralda|Andalusian|Bilbao|Casa Batllo|Costa Brava|Madrid|Park Guell|Puerta Alcala|Pyrenees|Ronda|Valencia|Tesla|Samsung|Galaxy|iPhone|Eiffel Tower|Louvre|Notre Dame|Sagrada Familia|Mont Saint Michel|Brooklyn|Manhattan|Bordeaux|Hollywood|Art Deco|Möbius|CMYK|NYC|USB|LED|SE|Model [SXY3]|Cybertruck|Roadster|Powerwall|Megapack|Robovan|Cybercab|Optimus)\b/g;
  const preserved = [...base.matchAll(names)].map(([word]) => word);
  let phrase = base.toLowerCase();
  for (const word of preserved) phrase = phrase.replace(word.toLowerCase(), word);
  const uncounted =
    /^(?:hands|stars|children|trainers|candies|gloves|shoes|two|three|four|the)\b/i.test(phrase);
  const noun = uncounted ? phrase : `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`;
  if (topic.endsWith('-flag')) {
    if (/outline|coloring/.test(body)) return `An outline drawing showing ${noun}.`;
    return `A color illustration showing ${noun}.`;
  }
  if (topic === 'mom')
    return `${outline ? 'An outline drawing' : mono ? 'A black-and-white illustration' : 'A family illustration'} showing ${noun}.`;
  if (['thank-you', 'happy-birthday'].includes(topic))
    return `${base}, ${outline ? 'drawn with open outlines' : 'illustrated as a decorative greeting'}.`;
  if (topic === 'tesla' && concepts.test(body))
    return `An imagined concept illustration showing ${noun.replace(/\s+concept\b/i, '')}.`;
  if (topic === 'mars' && /astronaut|habitat|greenhouse|footprint|salute/.test(body))
    return `${base}, an imagined Mars exploration scene.`;
  const medium = /watercolor/.test(body)
    ? 'Watercolor-style illustration'
    : outline
      ? 'Outline drawing'
      : mono
        ? 'Black-and-white illustration'
        : /photoreal/.test(body)
          ? 'Detailed illustration'
          : 'Illustration';
  return `${medium} showing ${noun}.`;
}
export function packageMetadata(topic, id, sourceSha256) {
  if (!contexts[topic] || !id.startsWith(topic + '-clipart-'))
    throw Error('Unexpected supplied identity');
  const body = id.slice((topic + '-clipart-').length);
  const outline = /outline|line-?art|coloring|minimal-thin-line/.test(body);
  const mono = /silhouette|engraving|black-white|woodcut|(?:^|-)ink(?:-|$)/.test(body);
  const product = ['tesla', 'iphone', 'samsung'].includes(topic)
    ? reviewedProductMetadata(productReviews[id], { sourceSha256 })
    : null;
  const subject = product?.subject ?? exact[id]?.[0] ?? subjectFor(topic, body);
  const caption =
    product?.caption ?? exact[id]?.[1] ?? captionFor(topic, body, subject, outline, mono);
  const style =
    exact[id]?.[2] ??
    (outline
      ? 'Outline'
      : mono
        ? 'Black & White'
        : /watercolor/.test(body)
          ? 'Watercolor'
          : 'Color');
  const title = subject + ' Clipart';
  if (!['Color', 'Outline', 'Black & White', 'Watercolor'].includes(style))
    throw Error('Unsupported reviewed style: ' + id);
  const alt = caption;
  const use = contexts[topic].use;
  const action = /outline|coloring|line-?art/.test(body)
    ? 'Pair the drawing with your own labels or use it as a coloring activity.'
    : `Use it in ${use}.`;
  const description = `${caption} ${action} Download the transparent WebP for a digital layout, or choose the matching PDF for printing.`;
  if (title.length > 165 || alt.length > 420 || description.length > 600)
    throw Error('Metadata exceeds readable bounds: ' + id);
  // An object's material is not the illustration technique: a wooden abacus
  // or a ceramic mug must not become "carved wood" or "sculpted" via its ID.
  const visualStyle = {
    Color: /cartoon|kawaii/.test(body) ? 'Cartoon illustration' : 'Full-color illustration',
    Outline: 'Line art',
    'Black & White': 'Black-and-white illustration',
    Watercolor: 'Watercolor-style illustration',
  }[style];
  return {
    title,
    alt,
    description,
    style,
    visualStyle,
    ...(product ? { productIdentity: product.productIdentity } : {}),
  };
}
export function packageCollectionCopy(topic, items) {
  const c = contexts[topic];
  const label =
    topic.endsWith('-flag') ||
    [
      'france',
      'spain',
      'paris',
      'new-york',
      'chicago',
      'miami',
      'los-angeles',
      'mars',
      'iphone',
      'samsung',
      'tesla',
    ].includes(topic)
      ? c.label
      : c.label.toLowerCase();
  if (!items.some((item) => item.id === c.cover))
    throw Error('The reviewed collection cover is missing: ' + topic);
  const selected = [c.cover];
  for (const pattern of [
    /flat-(?:rectangle|tricolor|banner)|full-moon|eiffel-tower|statue-of-liberty|cloud-gate|griffith-observatory|sagrada-familia|mont-saint-michel|model-s-front|twin-bell|steam-locomotive|spiral-lollipop|emmental|mother-baby-rocking|woman-dumbbell-curl/,
    /watercolor/,
    /outline|lineart/,
    /balloon|clay|realistic|photoreal/,
    /heart|flower|baby|child|garden/,
    /skyline|river|waving|paper/,
  ]) {
    const x = items.find((i) => pattern.test(i.id) && !selected.includes(i.id));
    if (x) selected.push(x.id);
  }
  for (const x of items) if (selected.length < 6 && !selected.includes(x.id)) selected.push(x.id);
  return {
    description: `${items.length} ${label} clipart designs for ${c.use}. Choose a transparent WebP image or a matching printable PDF.`,
    lead: c.lead,
    intro: c.intro,
    featured: selected.slice(0, 6),
    chips: c.chips.map((query) => ({
      label: readable(query.replace(new RegExp(`^${c.label}\\s+`, 'i'), '').replaceAll(' ', '-')),
      query,
    })),
    heading: `Find the ${label} design that fits your page`,
    paragraphs: [
      c.note,
      `Start with the subject and the space available in your layout. Open a design to compare its original dimensions and file sizes, preview its edges against different backgrounds and choose the download you need for ${c.use}.`,
      'In Clipart Studio, resize, rotate or crop the image and add your own text and shapes. Each illustration is one image layer; the objects and lettering inside it are not separate editable vector layers.',
    ],
    print:
      'Every design includes two separate downloads: a transparent WebP image and a single-page CMYK PDF. The original 1,254 × 1,254 pixel illustration is placed at 300 pixels per inch in the PDF, giving a 4.18 × 4.18 inch page. Choose actual-size printing to keep that scale. Enlarging reduces effective resolution; print one sample before making multiple copies.',
    related: c.related,
  };
}
