export {};
const root = document.querySelector<HTMLElement>('.library-index');
if (root) {
  const field = root.querySelector<HTMLInputElement>('#library-subject-search');
  const controls = root.querySelector<HTMLElement>('[data-index-filter]');
  const groups = [...root.querySelectorAll<HTMLElement>('[data-index-group]')];
  const rows = [...root.querySelectorAll<HTMLElement>('[data-index-subject]')];
  const status = root.querySelector<HTMLElement>('[data-index-status]');
  const empty = root.querySelector<HTMLElement>('[data-index-empty]');
  const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  if (field && controls && status && empty) {
    function filter() {
      const terms = normalize(field!.value).trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const row of rows) {
        row.hidden = !terms.every((term) =>
          normalize(row.dataset.indexKeywords || '').includes(term),
        );
        if (!row.hidden) visible++;
      }
      for (const group of groups) {
        group.hidden = !group.querySelector('[data-index-subject]:not([hidden])');
        const link = root!.querySelector<HTMLAnchorElement>(
          `.library-index-alphabet a[href="#${group.id}"]`,
        );
        if (link) link.hidden = group.hidden;
      }
      status!.textContent = `${visible} ${visible === 1 ? 'subject' : 'subjects'}${terms.length ? ' found' : ''}`;
      empty!.hidden = visible > 0;
    }
    field.addEventListener('input', filter);
    root.querySelector('[data-index-clear]')?.addEventListener('click', () => {
      field.value = '';
      filter();
      field.focus();
    });
    controls.hidden = false;
  }
}
