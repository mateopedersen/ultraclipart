const searchableText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function initTrustTools() {
  const tools = document.querySelector<HTMLFormElement>('[data-faq-tools]');
  if (tools && !tools.dataset.ready) {
    tools.dataset.ready = 'true';
    const search = tools.querySelector<HTMLInputElement>('input')!;
    const status = tools.querySelector<HTMLElement>('[data-faq-status]')!;
    const empty = document.querySelector<HTMLElement>('[data-faq-empty]')!;
    const groups = [...document.querySelectorAll<HTMLElement>('[data-faq-group]')];
    const questions = [...document.querySelectorAll<HTMLDetailsElement>('[data-faq-question]')];
    const text = new Map(
      questions.map((question) => [question, searchableText(question.textContent || '')]),
    );
    function filter() {
      const words = searchableText(search.value).trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const question of questions) {
        const match = words.every((word) => text.get(question)!.includes(word));
        question.hidden = !match;
        if (words.length) question.open = match;
        if (match) shown++;
      }
      for (const group of groups)
        group.hidden = !group.querySelector('[data-faq-question]:not([hidden])');
      empty.hidden = shown !== 0;
      status.textContent = words.length
        ? `${shown} of ${questions.length} questions match your search`
        : `${questions.length} questions across ${groups.length} topics`;
    }
    tools.hidden = false;
    tools.addEventListener('submit', (event) => {
      event.preventDefault();
      filter();
    });
    search.addEventListener('input', filter);
    tools.querySelector('[data-faq-clear]')!.addEventListener('click', () => {
      search.value = '';
      filter();
      search.focus();
    });
    tools.querySelector('[data-faq-expand]')!.addEventListener('click', () => {
      for (const question of questions) if (!question.hidden) question.open = true;
    });
    tools.querySelector('[data-faq-collapse]')!.addEventListener('click', () => {
      for (const question of questions) question.open = false;
    });
  }
  const builder = document.querySelector<HTMLElement>('[data-rights-builder]');
  if (builder && !builder.dataset.ready) {
    builder.dataset.ready = 'true';
    const url = builder.querySelector<HTMLInputElement>('#rights-url')!;
    const kind = builder.querySelector<HTMLSelectElement>('#rights-kind')!;
    const detail = builder.querySelector<HTMLTextAreaElement>('#rights-detail')!;
    const draft = builder.querySelector<HTMLTextAreaElement>('#rights-draft')!;
    const email = builder.querySelector<HTMLAnchorElement>('[data-rights-email]')!;
    const status = builder.querySelector<HTMLElement>('[data-rights-status]')!;
    function update() {
      draft.value = [
        `Type of concern: ${kind.value}`,
        `Affected URL: ${url.value.trim() || '[add the exact page or share URL]'}`,
        '',
        'Issue and requested action:',
        detail.value.trim() || '[describe the issue and the correction you request]',
        '',
        'Original work / evidence: [add a relevant source link]',
        'My relationship to the work: [explain if you are the creator, owner or representative]',
        'Reply email: [add your contact email]',
      ].join('\n');
      email.href = `mailto:ultraclipart@gmail.com?subject=${encodeURIComponent(`${kind.value} report`)}&body=${encodeURIComponent(draft.value)}`;
    }
    builder.hidden = false;
    builder.addEventListener('input', update);
    builder.addEventListener('change', update);
    update();
    builder.querySelector('[data-rights-copy]')!.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(draft.value);
        status.textContent = 'Report text copied. Review it in your email app before sending.';
      } catch {
        draft.focus();
        draft.select();
        status.textContent =
          'The draft is selected. Use your device’s Copy command, then paste it into your email app.';
      }
    });
  }
}
