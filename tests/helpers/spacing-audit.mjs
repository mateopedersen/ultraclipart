export function inspectSpacing() {
  const main = document.querySelector('main'),
    footer = document.querySelector('footer.site-footer');
  const visible = (element) => {
    const r = element.getBoundingClientRect(),
      style = getComputedStyle(element);
    return (
      r.width > 0 &&
      r.height > 0 &&
      style.visibility !== 'hidden' &&
      !['fixed', 'absolute'].includes(style.position) &&
      !element.closest('[hidden],dialog:not([open]),.sr-only,.visually-hidden')
    );
  };
  const sections = [...main.children].filter(visible).map((e) => ({
    name: e.id || e.className || e.tagName,
    top: e.getBoundingClientRect().top,
    bottom: e.getBoundingClientRect().bottom,
  }));
  const last = Math.max(...sections.map((e) => e.bottom));
  // A transparent outer wrapper can conceal its own trailing padding. Measure
  // painted surfaces and normal-flow content as well as that wrapper's edge.
  const contentEdges = [];
  const walk = (element, clipBottom = Infinity) => {
    if (!visible(element)) return;
    const style = getComputedStyle(element);
    const painted =
      (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
      style.backgroundImage !== 'none' ||
      style.boxShadow !== 'none' ||
      ['Top', 'Right', 'Bottom', 'Left'].some(
        (edge) => parseFloat(style[`border${edge}Width`]) > 0,
      );
    if (painted || /^(IMG|P|H[1-6]|BUTTON|INPUT|SELECT|SUMMARY|A)$/.test(element.tagName))
      contentEdges.push(Math.min(element.getBoundingClientRect().bottom, clipBottom));
    const nextClip = /hidden|auto|scroll|clip/.test(style.overflowY)
      ? Math.min(clipBottom, element.getBoundingClientRect().bottom)
      : clipBottom;
    for (const child of element.children) walk(child, nextClip);
  };
  for (const child of main.children) walk(child);
  const lastContent = Math.min(main.getBoundingClientRect().bottom, Math.max(...contentEdges));
  const galleries = [...main.querySelectorAll('.gallery')].filter(visible).map((gallery) => {
    const cards = [...gallery.querySelectorAll(':scope > .art-card')].filter(visible);
    const box = gallery.getBoundingClientRect();
    const rows = [];
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      let row = rows.find((entry) => Math.abs(entry.top - r.top) < 2);
      if (!row) {
        row = { top: r.top, cards: [] };
        rows.push(row);
      }
      row.cards.push({ left: r.left, right: r.right, width: r.width, height: r.height });
    }
    const tail = rows.at(-1)?.cards ?? [];
    const left = tail.length ? Math.min(...tail.map((r) => r.left)) - box.left : 0;
    const right = tail.length ? box.right - Math.max(...tail.map((r) => r.right)) : 0;
    const widths = cards.map((card) => card.getBoundingClientRect().width);
    return {
      selector: gallery.id || gallery.className,
      count: cards.length,
      rowCounts: rows.map((r) => r.cards.length),
      tailLeft: left,
      tailRight: right,
      centered: Math.abs(left - right) <= 2,
      widthVariation: widths.length ? Math.max(...widths) - Math.min(...widths) : 0,
      ids: cards.map((card) => card.dataset.id),
    };
  });
  return {
    footerGap: footer.getBoundingClientRect().top - last,
    contentFooterGap: footer.getBoundingClientRect().top - lastContent,
    // The visible fixed cookie notice reserves its own height so it never
    // covers the last footer controls. Only space beyond that reserve is a gap.
    uncoveredDocumentTail:
      document.documentElement.scrollHeight -
      (footer.getBoundingClientRect().bottom + scrollY) -
      parseFloat(getComputedStyle(document.body).paddingBottom),
    mainPadding: getComputedStyle(main).paddingBottom,
    footerMargin: getComputedStyle(footer).marginTop,
    sections,
    sectionGaps: sections
      .slice(1)
      .map((e, i) => ({ from: sections[i].name, to: e.name, gap: e.top - sections[i].bottom })),
    galleries,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
}
