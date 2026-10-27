/** Update the visible SVG without throwing away already decoded image nodes.
 * Only trusted documentSvg output enters this renderer; exports stay independent.
 */
function update(target: Element, source: Element) {
  for (const attribute of [...target.attributes])
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  for (const attribute of [...source.attributes])
    if (target.getAttribute(attribute.name) !== attribute.value)
      target.setAttribute(attribute.name, attribute.value);
  const children = [...source.childNodes];
  if (children.every((node) => node instanceof Element))
    for (const child of [...target.childNodes])
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) child.remove();
  for (let i = 0; i < children.length; i++) {
    const next = children[i];
    let current = target.childNodes[i];
    if (next instanceof Element && next.hasAttribute('data-layer')) {
      const key = next.getAttribute('data-layer');
      const existing = [...target.children].find((node) => node.getAttribute('data-layer') === key);
      if (existing && existing !== current) target.insertBefore(existing, current || null);
      current = target.childNodes[i];
    }
    if (
      current instanceof Element &&
      next instanceof Element &&
      current.namespaceURI === next.namespaceURI &&
      current.localName === next.localName &&
      current.getAttribute('data-layer') === next.getAttribute('data-layer')
    ) {
      update(current, next);
    } else if (current?.nodeType === Node.TEXT_NODE && next.nodeType === Node.TEXT_NODE) {
      if (current.textContent !== next.textContent) current.textContent = next.textContent;
    } else if (current) target.replaceChild(next, current);
    else target.append(next);
  }
  while (target.childNodes.length > children.length) target.lastChild!.remove();
}
export function reconcileCanvasSvg(canvas: HTMLElement, svg: SVGSVGElement) {
  const previous = canvas.firstElementChild;
  if (previous instanceof SVGSVGElement) update(previous, svg);
  else canvas.replaceChildren(svg);
  // Selection overlays are rebuilt from the current selection after the artwork.
  for (const child of [...canvas.children].slice(1)) child.remove();
}
