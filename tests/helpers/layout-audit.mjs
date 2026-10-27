// Runs inside a real browser after the page fonts and dynamic components settle.
export function inspectLayout() {
  const width = document.documentElement.clientWidth;
  const identify = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : '');
  const visible = (el) => {
    const r = el.getBoundingClientRect(),
      s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      !el.closest('[hidden],dialog:not([open]),.sr-only,.visually-hidden,.discovery-sr')
    );
  };
  const escapesClipping = (el, r) => {
    let left = r.left,
      right = r.right;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)) {
        const b = p.getBoundingClientRect();
        left = Math.max(left, b.left);
        right = Math.min(right, b.right);
      }
    }
    return right > width + 1 || left < -1;
  };
  const escaped = [...document.querySelectorAll('body *')]
    .filter((el) => {
      if (el.closest('svg,astro-dev-toolbar') || !visible(el)) return false;
      const r = el.getBoundingClientRect();
      return (r.left < -1 || r.right > width + 1) && escapesClipping(el, r);
    })
    .map((el) => ({
      selector: identify(el),
      text: (el.textContent || '').trim().slice(0, 100),
      left: Math.round(el.getBoundingClientRect().left),
      right: Math.round(el.getBoundingClientRect().right),
    }));
  const clipped = [
    ...document.querySelectorAll('h1,h2,h3,p,.card-title,.button,button,summary,label,dt,dd,th,td'),
  ]
    .filter((el) => {
      if (!visible(el) || el.closest('svg') || !el.textContent.trim()) return false;
      const s = getComputedStyle(el);
      if (el.clientWidth < 1 || s.display === 'inline') return false;
      return el.scrollWidth > el.clientWidth + 2 && !/auto|scroll/.test(s.overflowX);
    })
    .map((el) => ({
      selector: identify(el),
      text: el.textContent.trim().slice(0, 160),
      client: el.clientWidth,
      scroll: el.scrollWidth,
      overflow: getComputedStyle(el).overflowX,
    }));
  const frames = [...document.querySelectorAll('.card-media,.card-thumb,.home-benefit-art')]
    .filter(visible)
    .map((el) => ({
      width: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
    }));
  return {
    width,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > width + 1,
    escaped,
    clipped,
    frames,
  };
}
