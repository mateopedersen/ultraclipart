/** A generated filename is not a user edit and should not add an undo step. */
export function shouldPersistExportName(
  current: string | undefined,
  fallback: string,
  requested: string,
) {
  return current !== requested && (Boolean(current) || requested !== fallback);
}
