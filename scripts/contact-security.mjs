// Only the Contact page embeds Google Forms. Keep the rest of the site restricted.
export function contactContentSecurityPolicy(policy) {
  const directives = policy
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!directives.some((item) => item.startsWith('default-src ')))
    throw Error('A complete base CSP is required');
  return [
    ...directives.filter((item) => !/^frame-src\s/.test(item)),
    'frame-src https://docs.google.com',
  ].join('; ');
}
