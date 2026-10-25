import { initializeAnnotatedScreens } from './annotated-screens';

const teacherPage = document.querySelector<HTMLElement>('.teachers-page');
const taskNavigation = teacherPage?.querySelector<HTMLElement>('[data-teacher-tasks]');
if (teacherPage && taskNavigation) {
  const links = [...taskNavigation.querySelectorAll<HTMLAnchorElement>('[data-teacher-task]')];
  const plans = [...teacherPage.querySelectorAll<HTMLElement>('[data-teacher-plan]')];
  const select = (index: number, focus = false) => {
    links.forEach((link, position) => {
      const selected = position === index;
      link.setAttribute('aria-selected', String(selected));
      link.tabIndex = selected ? 0 : -1;
      plans[position].hidden = !selected;
    });
    if (focus) links[index].focus({ preventScroll: true });
  };
  const selectedFromHash = () => plans.findIndex((plan) => `#${plan.id}` === location.hash);
  const change = (index: number, focus = false) => {
    select(index, focus);
    history.replaceState(null, '', links[index].hash);
  };
  taskNavigation.setAttribute('role', 'tablist');
  links.forEach((link, index) => {
    link.setAttribute('role', 'tab');
    link.setAttribute('aria-controls', plans[index].id);
    plans[index].setAttribute('role', 'tabpanel');
    plans[index].setAttribute('aria-labelledby', link.id);
    plans[index].tabIndex = 0;
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      change(index);
    });
    link.addEventListener('keydown', (event) => {
      let next: number;
      switch (event.key) {
        case 'ArrowRight':
          next = (index + 1) % links.length;
          break;
        case 'ArrowLeft':
          next = (index - 1 + links.length) % links.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = links.length - 1;
          break;
        case ' ':
          event.preventDefault();
          change(index);
          return;
        default:
          return;
      }
      event.preventDefault();
      change(next, true);
    });
  });
  select(Math.max(0, selectedFromHash()));
  window.addEventListener('hashchange', () => {
    const index = selectedFromHash();
    if (index >= 0) select(index);
  });

  for (const plan of plans) {
    const copy = plan.querySelector<HTMLButtonElement>('[data-copy-plan]')!;
    const status = plan.querySelector<HTMLElement>('[data-copy-status]')!;
    const fallback = plan.querySelector<HTMLElement>('[data-copy-fallback]')!;
    const textArea = fallback.querySelector<HTMLTextAreaElement>('textarea')!;
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      const title = plan.querySelector('h3')!.textContent!.trim();
      const steps = [...plan.querySelectorAll<HTMLLIElement>('.tc-steps li')].map(
        (step, index) =>
          `${index + 1}. ${step.querySelector('h4')!.textContent!.trim()}\n${step.querySelector('p')!.textContent!.trim()}`,
      );
      const adapt = plan.querySelector('.tc-adapt p')!.textContent!.trim();
      const action = plan.querySelector<HTMLAnchorElement>('.tc-plan-resources .tc-button')!;
      const text = [
        title,
        ...steps,
        `Adapt for your class\n${adapt}`,
        `${action.textContent!.trim()}\n${action.href}`,
        `UltraClipart teacher resources\n${location.origin}/for-teachers/`,
      ].join('\n\n');
      copy.disabled = true;
      try {
        await navigator.clipboard.writeText(text);
        fallback.hidden = true;
        status.textContent = 'Steps copied. Paste them into your lesson notes.';
      } catch {
        textArea.value = text;
        fallback.hidden = false;
        textArea.focus();
        textArea.select();
        status.textContent = 'The steps are ready to copy in the text box.';
      } finally {
        copy.disabled = false;
      }
    });
  }

  const checks = [...teacherPage.querySelectorAll<HTMLInputElement>('[data-teacher-check]')];
  const progress = teacherPage.querySelector<HTMLElement>('[data-checklist-progress]')!;
  const updateProgress = () => {
    const count = checks.filter((check) => check.checked).length;
    progress.textContent = `${count} of ${checks.length} checked`;
  };
  checks.forEach((check) => check.addEventListener('change', updateProgress));
  updateProgress();

  const printButton = teacherPage.querySelector<HTMLButtonElement>('[data-print-teacher-plan]')!;
  const printStatus = teacherPage.querySelector<HTMLElement>('[data-teacher-print-status]')!;
  const finishPrint = () => document.body.removeAttribute('data-teacher-print');
  window.addEventListener('afterprint', finishPrint);
  window.matchMedia('print').addEventListener('change', (event) => {
    if (!event.matches) finishPrint();
  });
  printButton.hidden = false;
  printButton.addEventListener('click', () => {
    printStatus.textContent = '';
    document.body.setAttribute('data-teacher-print', 'true');
    try {
      window.print();
    } catch {
      finishPrint();
      printStatus.textContent =
        'The print dialog could not open. Use your browser’s Print command to print this page.';
    }
  });
  initializeAnnotatedScreens(teacherPage);
}
