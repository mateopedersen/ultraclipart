/** Turn supplied production descriptions into readable image descriptions.
 * File bytes and their embedded print metadata are never rewritten here. */
export function visibleSubject(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Missing source description');
  let text = raw.split('|')[0].trim();
  const breed = text.match(/the animal is specifically a ([^;]+?) with the defining appearance/);
  text = text.split(';')[0];
  if (breed) text = text.replace(/\b(cat|dog)\b/, `${breed[1]} $1`);
  text = text
    .replace(/^One\b/, 'A')
    .replace(
      /^A (?!(?:European|Eurasian|one|uni(?:corn|form|que|ted|t)|useful)\b)(?=[aeiou])/i,
      'An ',
    )
    .replace(
      /,?\s+(?:no|exactly|both|four complete|two distinct|whole body|full body|full-body and no)\b[^,.]*/gi,
      '',
    )
    .replace(
      /with accurate recognizable features and generous open coloring areas/i,
      'with open areas for coloring',
    )
    .replace(/with the defining appearance described below/gi, '')
    .replace(/,?\s*(?:illustrated|painted|rendered) in [\s\S]*/i, '')
    .replace(/\.\s*Rendered [\s\S]*/i, '')
    .replace(/,?\s*(?:isolated (?:as [^,]+|on)|on) (?:a )?transparent background[\s\S]*/i, '')
    .replace(/,?\s*transparent background[\s\S]*/i, '')
    .replace(/,?\s*(?:restricted to the animal|complete and readable)\b/gi, '')
    .replace(/habitat-appropriate leaf or coral sprig/gi, 'decorative sprig')
    .replace(/\bhand-painted\s+/gi, '')
    .replace(/\bcoherent\s+/gi, '')
    .replace(
      /,?\s*(?:recognizable species anatomy|whole animal|full character|full distinct bodies|full complete animal|complete anatomy)\b[^,.]*/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .replace(/[,. ]+$/, '');
  // Removing a negative production constraint can leave a dangling connector.
  while (/\b(?:and|with|in|on|plus|or)$/.test(text))
    text = text.replace(/\b(?:and|with|in|on|plus|or)$/, '').replace(/[,. ]+$/, '');
  if (!text || /described below|CMYK|pixels per inch|no words|no digits/i.test(text))
    throw new Error('Source description needs an editorial correction');
  return text + '.';
}
