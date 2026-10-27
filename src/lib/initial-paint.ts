/** Let the server-rendered page paint before hydrating interactive tools and requesting
 * their secondary data. No timer, user interaction or network fixture
 * is needed; hidden tabs must not wait for suspended animation frames.
 */
export function nextPaint() {
  return new Promise<void>((resolve) => {
    if (document.visibilityState !== 'visible') return resolve();
    let first = 0,
      second = 0;
    const finish = () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      document.removeEventListener('visibilitychange', changed);
      resolve();
    };
    const changed = () => {
      if (document.visibilityState !== 'visible') finish();
    };
    document.addEventListener('visibilitychange', changed);
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(finish);
    });
  });
}
let ready: Promise<void> | undefined;
export function afterInitialPaint() {
  return (ready ??= nextPaint());
}
