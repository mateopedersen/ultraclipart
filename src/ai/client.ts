import { examples, styles } from './presets';
import { history, type Generation } from './storage';
const root = document.querySelector<HTMLElement>('[data-ai-builder]');
if (root) initialize(root);
function initialize(root: HTMLElement) {
  const element = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const prompt = element<HTMLTextAreaElement>('ai-prompt'),
    style = element<HTMLSelectElement>('ai-style');
  const canvas = element<HTMLCanvasElement>('ai-canvas'),
    context = canvas.getContext('2d', { willReadFrequently: true })!;
  const form = element<HTMLFormElement>('ai-form'),
    generate = element<HTMLButtonElement>('ai-generate');
  const before = element<HTMLImageElement>('ai-before'),
    status = element('ai-status'),
    stateLabel = element('ai-state');
  let active: Generation | undefined,
    records: Generation[] = [],
    snapshots: ImageData[] = [],
    cursor = -1;
  let busy = false,
    token = '',
    widget = '',
    stopped = false,
    activeURL = '',
    compare = false;
  let request: AbortController | undefined;
  let quota:
    | {
        enabled: boolean;
        remaining: number;
        globalRemaining: number;
        resetAt: string;
        sitekey: string;
        model: string;
        cooldownUntil?: string | null;
      }
    | undefined;
  let thumbnailURLs: string[] = [];
  const api = '/api/ai/clipart/';
  const ingredients = new Set<string>();
  const moods = new Set<string>();
  const swatches = new Set<string>();
  const ingredientNames: Record<string, string> = {
    cabin: 'a wooden cabin',
    trees: 'pine trees',
    fox: 'a little fox',
  };
  const moodNames: Record<string, string> = {
    cozy: 'warm and cozy atmosphere',
    minimal: 'minimal uncluttered composition',
  };
  const colorNames: Record<string, string> = {
    '#164e44': 'deep forest green',
    '#e5532f': 'terracotta orange',
    '#ffe7c9': 'warm cream',
    '#58a6d6': 'sky blue',
    '#f49a28': 'golden amber',
  };
  const composedIdea = () => {
    const details = [
      ingredients.size ? `Include: ${[...ingredients].join(', ')}.` : '',
      moods.size ? `Mood: ${[...moods].join(', ')}.` : '',
      swatches.size
        ? `Accent colors: ${[...swatches].map((c) => colorNames[c] || c).join(', ')}.`
        : '',
    ].filter(Boolean);
    return [prompt.value.trim(), ...details].join(' ');
  };
  const clearIngredients = () => {
    ingredients.clear();
    moods.clear();
    swatches.clear();
    root
      .querySelectorAll<HTMLElement>('[data-ai-ingredient], [data-ai-mood], [data-ai-swatch]')
      .forEach((b) => b.setAttribute('aria-pressed', 'false'));
    root.querySelector('#ai-custom-ingredients')?.replaceChildren();
  };

  const errorMessages: Record<string, string> = {
    capacity_or_rate_limit:
      'Please wait one minute before trying again. If your daily or shared-network limit has been reached, come back after the reset shown below. Your current artwork is safe.',
    capacity_exhausted:
      'Today’s free generation capacity is used up. Editing and downloads are still available.',
    content_blocked:
      'This description could not be accepted. Try a different, appropriate creative idea.',
    verification_failed:
      'Security verification expired or did not finish. Complete the refreshed verification before trying again.',
    verification_required: 'Please complete the security verification before generating.',
    session_required:
      'Your generation session expired. Reload this page to start a new session; saved artwork stays in this browser.',
    translation_unavailable:
      'Your description could not be prepared right now. Try clearer, shorter wording later. No automatic retry was made.',
    generation_timeout:
      'The model took too long to respond. This request may still count toward today’s limit. Your earlier artwork is safe.',
    service_unavailable:
      'The model is temporarily unavailable. Try again later; your local editing tools still work.',
    generation_unavailable:
      'Generation is temporarily paused. Your saved artwork and Clipart Studio remain available.',
    invalid_prompt:
      'Use a clear description between 3 and 1,200 characters without code or markup.',
    prompt_too_detailed:
      'Your description and style settings are too long together. Shorten a few details and try again.',
    invalid_style: 'Please choose one of the available illustration styles.',
    invalid_option: 'One of the illustration settings is invalid. Reset the options and try again.',
    origin_not_allowed:
      'Generation is available on ultraclipart.com. Open the official AI Clipart Builder to continue.',
    network_verification_unavailable: 'Your network could not be verified. Try again later.',
    provider_unavailable:
      'The image model is temporarily unavailable. Try again later; your current artwork is safe.',
    invalid_provider_result:
      'The model returned an image that could not be verified. No automatic retry was made.',
    request_too_large: 'This request is too large. Shorten the description before trying again.',
    unsupported_option:
      'A setting is no longer supported. Reload the page to use the current controls.',
  };

  type Turnstile = {
    render: (target: HTMLElement, options: Record<string, unknown>) => string;
    reset: (widget: string) => void;
    remove: (widget: string) => void;
  };
  const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  const actionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-ai-action]')];
  const say = (state: string, text: string) => {
    stateLabel.dataset.state = state;
    stateLabel.textContent =
      (
        {
          idle: 'Ready for an idea',
          validating: 'Checking request',
          generating: 'Creating your image',
          ready: 'Ready to make yours',
          editing: 'Editing on this device',
          exporting: 'Preparing your file',
          'capacity-exhausted': 'Daily limit reached',
          blocked: 'Generation unavailable',
          error: 'Needs attention',
          offline: 'You are offline',
        } as Record<string, string>
      )[state] || state;
    status.textContent = text;
    const stage = ['validating', 'generating'].includes(state)
      ? 'make'
      : active
        ? 'refine'
        : 'idea';
    root.querySelectorAll<HTMLElement>('[data-ai-step]').forEach((button) => {
      if (button.dataset.aiStep === stage) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  };
  const count = () => {
    element('ai-count').textContent = `${prompt.value.length} / 1200`;
  };
  const selectStyle = () => {
    root
      .querySelectorAll<HTMLButtonElement>('[data-ai-style]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.aiStyle === style.value)),
      );
    element('ai-style-note').textContent = styles.find(([id]) => id === style.value)?.[2] || '';
  };
  const updateButtons = () => {
    generate.disabled =
      busy ||
      !navigator.onLine ||
      !quota?.enabled ||
      quota.remaining < 1 ||
      quota.globalRemaining < 1 ||
      !token ||
      Boolean(quota?.cooldownUntil && Date.parse(quota.cooldownUntil) > Date.now());
    generate.setAttribute('aria-busy', String(busy));
    root
      .querySelectorAll<HTMLButtonElement>(
        '[data-ai-ingredient], [data-ai-mood], [data-ai-swatch], [data-ai-theme], [data-ai-concept], [data-ai-style], [data-ai-add-ingredient]',
      )
      .forEach((button) => (button.disabled = busy));
    root
      .querySelectorAll<HTMLButtonElement>('[data-ai-step="refine"]')
      .forEach((button) => (button.disabled = busy || !active));
    for (const button of actionButtons) {
      const action = button.dataset.aiAction!;
      if (['random', 'improve', 'copy', 'reset', 'clear'].includes(action)) button.disabled = busy;
      else if (action === 'undo') button.disabled = busy || cursor < 1;
      else if (action === 'redo') button.disabled = busy || cursor >= snapshots.length - 1;
      else if (action === 'again') button.disabled = !active || generate.disabled;
      else button.disabled = busy || !active;
    }
  };
  const toBlob = (mime = 'image/png', quality?: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('This browser could not create the image file.')),
        mime,
        quality,
      ),
    );
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const quality = () => {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let alpha = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) alpha++;
    element('ai-dimensions').textContent =
      `${canvas.width} × ${canvas.height} px · ${alpha ? 'real transparency' : 'solid background'}`;
    element('ai-quality').textContent =
      `${canvas.width} × ${canvas.height} px · ${(canvas.width / 300).toFixed(1)} × ${(canvas.height / 300).toFixed(1)} inches at 300 PPI. ${alpha ? `${((alpha / (pixels.length / 4)) * 100).toFixed(1)}% of pixels contain transparency.` : 'No transparent pixels yet.'} Original generation: 1024 × 1024 px. Enlarging does not add detail.`;
    element<HTMLInputElement>('ai-resize').value = String(canvas.width);
    element<HTMLInputElement>('ai-crop-width').value = String(canvas.width);
    element<HTMLInputElement>('ai-crop-height').value = String(canvas.height);
    element<HTMLInputElement>('ai-crop-x').value = '0';
    element<HTMLInputElement>('ai-crop-y').value = '0';
  };
  const stopCompare = () => {
    compare = false;
    before.hidden = true;
    canvas.hidden = !active;
    root.querySelector('[data-ai-action="compare"]')?.setAttribute('aria-pressed', 'false');
  };
  const snapshot = () => {
    snapshots.splice(cursor + 1);
    snapshots.push(context.getImageData(0, 0, canvas.width, canvas.height));
    while (
      snapshots.length > 1 &&
      (snapshots.length > 10 ||
        snapshots.reduce((total, item) => total + item.data.byteLength, 0) > 32 * 1024 * 1024)
    )
      snapshots.shift();
    cursor = snapshots.length - 1;
    quality();
    updateButtons();
  };
  const renderHistory = () => {
    for (const url of thumbnailURLs) URL.revokeObjectURL(url);
    thumbnailURLs = [];
    const list = element('ai-history');
    list.replaceChildren();
    const concepts = root.querySelector<HTMLElement>('#ai-concepts');
    concepts?.replaceChildren();
    if (concepts) concepts.hidden = !active;
    const conceptLimit = Number(
      root.querySelector<HTMLSelectElement>('#ai-concept-count')?.value || 4,
    );
    for (const item of records) {
      const button = document.createElement('button'),
        image = document.createElement('img');
      const url = URL.createObjectURL(item.edited || item.original);
      thumbnailURLs.push(url);
      image.src = url;
      image.alt = '';
      image.width = 150;
      image.height = 150;
      image.loading = 'lazy';
      button.type = 'button';
      button.append(image);
      button.setAttribute('aria-label', `Open image: ${item.prompt.slice(0, 160)}`);
      button.setAttribute('aria-pressed', String(active?.id === item.id));
      button.addEventListener('click', () => {
        if (!busy) void open(item).catch(failure);
      });
      list.append(button);
      if (concepts && concepts.children.length < conceptLimit) {
        const concept = button.cloneNode(true) as HTMLButtonElement;
        concept.className = 'ai-saved-concept';
        const label = document.createElement('span');
        label.textContent = active?.id === item.id ? 'Selected' : item.prompt.slice(0, 64);
        concept.append(label);
        concept.addEventListener('click', () => {
          if (!busy) void open(item).catch(failure);
        });
        concepts.append(concept);
      }
    }
    element('ai-history-count').textContent =
      `${records.length} image${records.length === 1 ? '' : 's'}`;
    if (!records.length) {
      const p = document.createElement('p');
      p.className = 'ai-small';
      p.textContent = 'Your recent results will appear here.';
      list.append(p);
    }
  };
  const persist = async () => {
    if (!active) return;
    active.edited = await toBlob();
    try {
      records = await history('write', active);
    } catch (error) {
      element('ai-storage-note').textContent = message(error);
      records = [active, ...records.filter((item) => item.id !== active!.id)].slice(0, 12);
    }
    renderHistory();
  };
  async function open(item: Generation) {
    const bitmap = await createImageBitmap(item.edited || item.original);
    active = item;
    root.classList.add('ai-has-image');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    element('ai-empty').hidden = true;
    canvas.hidden = false;
    stopCompare();
    snapshots = [];
    cursor = -1;
    snapshot();
    if (activeURL) URL.revokeObjectURL(activeURL);
    activeURL = URL.createObjectURL(item.original);
    before.src = activeURL;
    element('ai-used-prompt').hidden = false;
    element('ai-used-prompt-text').textContent = item.composedPrompt || item.prompt;
    clearIngredients();
    prompt.value = item.prompt;
    style.value = item.style;
    count();
    selectStyle();
    renderHistory();
    say(
      'ready',
      'Your image is ready. Check the details, refine the background, or continue in Clipart Studio.',
    );
  }
  function message(error: unknown) {
    return error instanceof Error
      ? error.message
      : 'Something went wrong. Your current image has been kept.';
  }
  function failure(error: unknown) {
    busy = false;
    updateButtons();
    say(navigator.onLine ? 'error' : 'offline', message(error));
  }
  async function loadTurnstile(sitekey: string) {
    if (widget || !sitekey) return;
    if (!turnstile())
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(
            new Error(
              'Security verification could not load. Check your connection or browser privacy settings.',
            ),
          );
        document.head.append(script);
      });
    const service = turnstile();
    if (!service) throw new Error('Security verification is not available. Reload to try again.');
    widget = service.render(element('ai-turnstile'), {
      sitekey,
      action: 'clipart',
      theme: 'light',
      size: 'flexible',
      callback: (value: string) => {
        token = value;
        updateButtons();
      },
      'expired-callback': () => {
        token = '';
        updateButtons();
      },
      'error-callback': () => {
        token = '';
        updateButtons();
        say(
          'blocked',
          'Security verification needs another try. Reload this page; your saved images will remain.',
        );
      },
    });
  }
  async function refreshQuota() {
    try {
      const response = await fetch(api + 'quota', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error(
          'Generation is temporarily unavailable. You can still edit and download your saved images.',
        );
      quota = await response.json();
      if (!quota || typeof quota.remaining !== 'number' || typeof quota.sitekey !== 'string')
        throw new Error('Generation settings could not be loaded.');
      const reset = new Date(quota.resetAt).toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
      element('ai-quota').textContent =
        `${quota.remaining} of 2 free generations left for you today. Shared capacity applies. Resets ${reset}.`;
      if (!quota.enabled)
        say(
          'blocked',
          'Generation is temporarily paused. Your saved images, downloads and Clipart Studio remain available.',
        );
      else if (quota.remaining < 1 || quota.globalRemaining < 1)
        say(
          'capacity-exhausted',
          'Today’s free generation capacity is used up. Editing and downloads are still available.',
        );
      else {
        await loadTurnstile(quota.sitekey);
        if (quota.cooldownUntil && Date.parse(quota.cooldownUntil) > Date.now())
          say(
            'blocked',
            `Generation is briefly paused to protect free capacity. Try again after ${new Date(quota.cooldownUntil).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Local editing remains available.`,
          );
      }
    } catch (error) {
      quota = undefined;
      say(navigator.onLine ? 'blocked' : 'offline', message(error));
      element('ai-quota').textContent =
        'Capacity could not be checked. No generation has been requested.';
    }
    updateButtons();
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || generate.disabled) return;
    if (!prompt.value.trim()) {
      prompt.focus();
      return;
    }
    if (composedIdea().length > 1200) {
      say('error', 'Please keep your description under 1,200 characters.');
      prompt.focus();
      return;
    }
    const submittedIdea = composedIdea();
    const wantsTransparency = root.querySelector<HTMLInputElement>('#ai-transparent')?.checked;
    busy = true;
    stopped = false;
    updateButtons();
    stopCompare();
    element('ai-cancel').hidden = false;
    say('validating', 'Verifying your request and reserving one free generation…');
    request = new AbortController();
    const timeout = window.setTimeout(() => request?.abort(), 110000);
    try {
      const options = Object.fromEntries(
        ['composition', 'palette', 'detail', 'outline', 'margin'].map((name) => [
          name,
          element<HTMLSelectElement>('ai-' + name).value,
        ]),
      );
      say(
        'generating',
        'The model is creating one image from your description. This can take a moment. Your previous work stays safe.',
      );
      const response = await fetch(api + 'generate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          prompt: submittedIdea,
          style: style.value,
          ...options,
          background: 'white',
          turnstileToken: token,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const error =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message ||
              result.message ||
              'Generation could not finish. No automatic retry was made.';
        if (response.status === 429) say('capacity-exhausted', errorMessages[error] || error);
        else say(response.status === 403 ? 'blocked' : 'error', errorMessages[error] || error);
        return;
      }
      if (
        typeof result.image !== 'string' ||
        result.image.length > 12000000 ||
        result.width !== 1024 ||
        result.height !== 1024
      )
        throw new Error('The model returned an invalid image. Please try later.');
      const binary = atob(result.image),
        bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const image = new Blob([bytes], { type: 'image/jpeg' });
      const item: Generation = {
        id: crypto.randomUUID(),
        prompt: result.prompt || prompt.value.trim(),
        composedPrompt: result.composedPrompt || '',
        style: result.style || style.value,
        model: result.model,
        createdAt: result.createdAt,
        width: 1024,
        height: 1024,
        original: image,
      };
      await open(item);
      if (wantsTransparency) {
        try {
          const note = await cutout();
          snapshot();
          say('ready', `Your image is ready. ${note}`);
        } catch {
          say(
            'ready',
            'Your image is ready. Automatic background removal could not finish; use Refine design to adjust it.',
          );
        }
      }
      await persist();
    } catch (error) {
      say(
        navigator.onLine ? 'error' : 'offline',
        request.signal.aborted
          ? stopped
            ? 'You stopped waiting. The server may already be generating, so this request can still count toward today’s limit. Your earlier images are safe.'
            : 'The request timed out. It may still count toward today’s limit. No automatic retry was made.'
          : message(error),
      );
    } finally {
      window.clearTimeout(timeout);
      busy = false;
      token = '';
      element('ai-cancel').hidden = true;
      if (widget) turnstile()?.reset(widget);
      await refreshQuota();
      updateButtons();
    }
  });
  element('ai-refresh-quota').addEventListener('click', () => void refreshQuota());
  element('ai-cancel').addEventListener('click', () => {
    stopped = true;
    request?.abort();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-ai-style]').forEach((button) =>
    button.addEventListener('click', () => {
      style.value = button.dataset.aiStyle!;
      selectStyle();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-ai-ingredient]').forEach((button) =>
    button.addEventListener('click', () => {
      const key = button.dataset.aiIngredient!;
      if (key === 'custom') {
        const input = root.querySelector<HTMLInputElement>('#ai-ingredient-custom');
        const panel = root.querySelector<HTMLElement>('#ai-custom-ingredient-panel');
        if (panel) panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        if (input) {
          input.hidden = false;
          input.focus();
        }
        return;
      }
      const value = ingredientNames[key];
      if (!value) return;
      ingredients.has(value) ? ingredients.delete(value) : ingredients.add(value);
      button.setAttribute('aria-pressed', String(ingredients.has(value)));
    }),
  );
  const addIngredient = () => {
    const input = root.querySelector<HTMLInputElement>('#ai-ingredient-custom');
    const value = input?.value.trim().slice(0, 80);
    if (!value || ingredients.has(value) || ingredients.size >= 8) return;
    ingredients.add(value);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = value + ' ×';
    chip.setAttribute('aria-label', 'Remove ingredient: ' + value);
    chip.addEventListener('click', () => {
      if (!busy) {
        ingredients.delete(value);
        chip.remove();
      }
    });
    root.querySelector('#ai-custom-ingredients')?.append(chip);
    input!.value = '';
  };
  root.querySelector('[data-ai-add-ingredient]')?.addEventListener('click', addIngredient);
  root.querySelector('#ai-ingredient-custom')?.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      event.preventDefault();
      addIngredient();
    }
  });
  for (const [attribute, selected, names] of [
    ['mood', moods, moodNames],
    ['swatch', swatches, colorNames],
  ] as const) {
    root.querySelectorAll<HTMLButtonElement>(`[data-ai-${attribute}]`).forEach((button) =>
      button.addEventListener('click', () => {
        const key = button.getAttribute(`data-ai-${attribute}`)!;
        const value = attribute === 'mood' ? names[key] : key;
        if (!value) return;
        selected.has(value) ? selected.delete(value) : selected.add(value);
        button.setAttribute('aria-pressed', String(selected.has(value)));
      }),
    );
  }
  root.querySelectorAll<HTMLButtonElement>('[data-ai-view]').forEach((button) =>
    button.addEventListener('click', () => {
      const view = button.dataset.aiView!;
      root.querySelector('#ai-concept-board')?.setAttribute('data-view', view);
      root
        .querySelectorAll<HTMLButtonElement>('[data-ai-view]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }),
  );
  root.querySelector('#ai-concept-count')?.addEventListener('change', renderHistory);
  const themes: Record<string, string> = {
    animals:
      'A lifelike baby deer standing beside wildflowers, gentle eyes, detailed soft fur, full body.',
    florals: 'A graceful bouquet of pink peonies, orange daisies and delicate green leaves.',
    holidays:
      'A festive red ribbon bow with evergreen branches, pine cones and bright red berries.',
    school: 'A cheerful school arrangement with colored pencils, three books and a red apple.',
    food: 'A golden flaky croissant beside a porcelain teacup with delicate blue flowers.',
    nature:
      'A cozy wooden cabin nestled among tall pine trees, a winding path and warm golden sunlight.',
  };
  root.querySelectorAll<HTMLButtonElement>('[data-ai-theme]').forEach((button) =>
    button.addEventListener('click', () => {
      clearIngredients();
      prompt.value = themes[button.dataset.aiTheme!] || '';
      count();
      prompt.focus();
      say('idle', 'Theme added to your description. Choose your details, then create one image.');
    }),
  );
  const conceptStyles = ['cut-paper', 'realistic', 'black-white', 'watercolor'];
  root.querySelectorAll<HTMLButtonElement>('[data-ai-concept]').forEach((button) =>
    button.addEventListener('click', () => {
      clearIngredients();
      prompt.value = themes.nature;
      style.value = conceptStyles[Number(button.dataset.aiConcept)] || 'realistic';
      count();
      selectStyle();
      root
        .querySelectorAll('[data-ai-concept]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      say(
        'idle',
        'Example direction selected. Create your own image to enable editing and downloads.',
      );
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-ai-step]').forEach((button) =>
    button.addEventListener('click', () => {
      if (button.dataset.aiStep === 'idea') {
        prompt.focus();
        prompt.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else if (button.dataset.aiStep === 'make')
        element('ai-preview-title').scrollIntoView({ block: 'center', behavior: 'smooth' });
      else if (active) {
        const details = root.querySelector<HTMLDetailsElement>('#ai-refine-tools');
        if (details) {
          details.open = true;
          details.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }),
  );
  prompt.addEventListener('input', count);
  style.addEventListener('change', selectStyle);
  root.querySelectorAll<HTMLButtonElement>('[data-ai-example]').forEach((button) =>
    button.addEventListener('click', () => {
      const example = examples[Number(button.dataset.aiExample)];
      clearIngredients();
      prompt.value = example.prompt;
      style.value = example.style;
      count();
      selectStyle();
      prompt.focus();
      say('idle', 'Example prompt added. Make it your own, then generate one image.');
    }),
  );
  async function cutout() {
    const data = context.getImageData(0, 0, canvas.width, canvas.height),
      worker = new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' });
    const result = await new Promise<{ pixels: Uint8ClampedArray; removed: number }>(
      (resolve, reject) => {
        const timeout = window.setTimeout(() => {
          worker.terminate();
          reject(new Error('Background cleanup took too long. Use Studio for manual refinement.'));
        }, 20000);
        worker.onmessage = (event) => {
          window.clearTimeout(timeout);
          worker.terminate();
          resolve(event.data);
        };
        worker.onerror = () => {
          window.clearTimeout(timeout);
          worker.terminate();
          reject(new Error('Background cleanup could not run. Your image is unchanged.'));
        };
        worker.postMessage(
          {
            pixels: data.data,
            width: data.width,
            height: data.height,
            tolerance: Number(element<HTMLInputElement>('ai-tolerance').value),
          },
          [data.data.buffer],
        );
      },
    );
    context.putImageData(
      new ImageData(new Uint8ClampedArray(result.pixels), canvas.width, canvas.height),
      0,
      0,
    );
    return result.removed
      ? 'Light background removed. Inspect pale subjects and fine edges; use Smart Select in Studio to refine them.'
      : 'No connected light background was found. Try a higher tolerance or refine the selection in Studio.';
  }
  async function run(action: string) {
    if (busy) return;
    if (action === 'random') {
      const example = examples[Math.floor(Math.random() * examples.length)];
      clearIngredients();
      prompt.value = example.prompt;
      style.value = example.style;
      count();
      selectStyle();
      prompt.focus();
      return;
    }
    if (action === 'reset') {
      clearIngredients();
      prompt.value = '';
      style.value = 'realistic';
      count();
      selectStyle();
      prompt.focus();
      return;
    }
    if (action === 'copy') {
      if (!navigator.clipboard) {
        prompt.focus();
        prompt.select();
        say('idle', 'Your description is selected. Use your browser’s Copy command.');
        return;
      }
      await navigator.clipboard.writeText(prompt.value);
      say('idle', 'Your description has been copied.');
      return;
    }
    if (action === 'improve') {
      const addition =
        ' Show the complete subject with clear edges and generous white space on a clean white background.';
      if (!prompt.value.trim()) {
        prompt.focus();
        say('idle', 'Describe your subject first, then add clipart details.');
        return;
      }
      if (!prompt.value.includes(addition.trim()) && prompt.value.length + addition.length <= 1200)
        prompt.value += addition;
      count();
      say('idle', 'Added composition and background details. Your original words are unchanged.');
      return;
    }
    if (action === 'clear') {
      if (
        !window.confirm(
          'Delete all AI images saved in this browser? Downloaded files and your separate Studio projects will stay.',
        )
      )
        return;
      await history('clear');
      const { clearStudioTransfers } = await import('./transfer');
      await clearStudioTransfers();
      records = [];
      active = undefined;
      root.classList.remove('ai-has-image');
      snapshots = [];
      cursor = -1;
      canvas.hidden = true;
      before.hidden = true;
      element('ai-empty').hidden = false;
      element('ai-used-prompt').hidden = true;
      if (activeURL) URL.revokeObjectURL(activeURL);
      renderHistory();
      updateButtons();
      say('idle', 'Saved AI images cleared from this browser.');
      return;
    }
    if (!active) return;
    if (action === 'again') {
      form.requestSubmit();
      return;
    }
    if (action === 'compare') {
      compare = !compare;
      before.hidden = !compare;
      canvas.hidden = compare;
      root
        .querySelector('[data-ai-action="compare"]')
        ?.setAttribute('aria-pressed', String(compare));
      return;
    }
    stopCompare();
    if (action === 'undo' || action === 'redo') {
      cursor += action === 'undo' ? -1 : 1;
      const saved = snapshots[cursor];
      if (!saved) return;
      canvas.width = saved.width;
      canvas.height = saved.height;
      context.putImageData(saved, 0, 0);
      quality();
      updateButtons();
      await persist();
      say('ready', action === 'undo' ? 'Image edit undone.' : 'Image edit restored.');
      return;
    }
    busy = true;
    updateButtons();
    try {
      if (['download', 'pdf', 'project', 'studio', 'share'].includes(action)) {
        say(
          'exporting',
          action === 'studio'
            ? 'Preparing your image for Clipart Studio…'
            : action === 'share'
              ? 'Preparing your current image to share. Nothing has been uploaded.'
              : 'Preparing your download…',
        );
        if (action === 'share') {
          const blob = await toBlob();
          const { openShare } = await import('../share/client');
          await openShare({
            kind: 'creation',
            trigger: root.querySelector<HTMLButtonElement>('[data-ai-action=share]') || undefined,
            title: 'My AI clipart',
            blob,
            sourceUrl: 'https://ultraclipart.com/ai-clipart-generator/',
          });
          say(
            'ready',
            'Sharing options are ready for your current image. Your private description and history stay on this device.',
          );
          return;
        }
        if (action === 'pdf') {
          const { downloadAiPdf } = await import('./pdf-export');
          await downloadAiPdf(await toBlob(), 'my-ai-clipart.pdf', {
            paper:
              root.querySelector<HTMLSelectElement>('#ai-pdf-paper')?.value === 'a4'
                ? 'a4'
                : 'letter',
            allowLargePdf: root.querySelector<HTMLInputElement>('#ai-pdf-large')?.checked === true,
          });
          say(
            'ready',
            'CMYK PDF downloaded at native 300 PPI. Open Studio for page layouts and editable text.',
          );
          return;
        }
        if (action === 'download') {
          let blob = await toBlob('image/webp', 0.95);
          if (blob.type !== 'image/webp') {
            const { encodeWebp } = await import('../editor/webp-fallback');
            blob = await encodeWebp(context.getImageData(0, 0, canvas.width, canvas.height), 0.95);
          }
          download(blob, 'my-ai-clipart.webp');
          say('ready', 'WebP downloaded with your current image dimensions and transparency.');
          return;
        }
        const transfer = await import('./transfer');
        const blob = await toBlob();
        const metadata = {
          prompt: active.prompt,
          style: active.style,
          model: active.model,
          createdAt: active.createdAt,
          composedPrompt: active.composedPrompt,
        };
        if (action === 'project') {
          download(
            await transfer.createStudioProject(blob, metadata),
            'my-ai-clipart-project.json',
          );
          say('ready', 'Editable project downloaded. Open it in Clipart Studio to continue.');
          return;
        }
        try {
          const handoff = await transfer.createStudioTransfer(blob, metadata);
          window.location.assign(handoff.url);
        } catch {
          download(
            await transfer.createStudioProject(blob, metadata),
            'my-ai-clipart-project.json',
          );
          say(
            'ready',
            'Browser transfer is unavailable. Your project was downloaded instead. Open Clipart Studio and choose Open project.',
          );
        }
        return;
      }
      say('editing', 'Applying an image edit on this device…');
      let note = 'Local edit applied. Compare with the original or undo at any time.';
      const w = canvas.width,
        h = canvas.height;
      if (action === 'cutout') note = await cutout();
      else if (action === 'background') {
        context.save();
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = element<HTMLInputElement>('ai-background').value;
        context.fillRect(0, 0, w, h);
        context.restore();
      } else if (action === 'bw') {
        const data = context.getImageData(0, 0, w, h);
        for (let i = 0; i < data.data.length; i += 4) {
          const gray = Math.round(
            0.2126 * data.data[i] + 0.7152 * data.data[i + 1] + 0.0722 * data.data[i + 2],
          );
          data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
        }
        context.putImageData(data, 0, 0);
      } else {
        const copy = document.createElement('canvas');
        copy.width = w;
        copy.height = h;
        copy.getContext('2d')!.drawImage(canvas, 0, 0);
        if (action === 'rotate') {
          canvas.width = h;
          canvas.height = w;
          context.translate(h, 0);
          context.rotate(Math.PI / 2);
          context.drawImage(copy, 0, 0);
          context.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (action === 'flip') {
          context.clearRect(0, 0, w, h);
          context.translate(w, 0);
          context.scale(-1, 1);
          context.drawImage(copy, 0, 0);
          context.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (action === 'resize') {
          const width = Number(element<HTMLInputElement>('ai-resize').value),
            height = Math.round((h * width) / w);
          if (
            !Number.isInteger(width) ||
            width < 64 ||
            width > 2048 ||
            height < 64 ||
            height > 2048
          )
            throw new Error('Choose dimensions between 64 and 2048 pixels.');
          canvas.width = width;
          canvas.height = height;
          context.imageSmoothingQuality = 'high';
          context.drawImage(copy, 0, 0, width, height);
        }
        if (action === 'crop') {
          const values = ['x', 'y', 'width', 'height'].map((key) =>
            Number(element<HTMLInputElement>('ai-crop-' + key).value),
          );
          const [x, y, width, height] = values;
          if (
            values.some((value) => !Number.isInteger(value)) ||
            x < 0 ||
            y < 0 ||
            width < 64 ||
            height < 64 ||
            x + width > w ||
            y + height > h
          )
            throw new Error(
              'Keep the crop inside your image, with a minimum width and height of 64 pixels.',
            );
          canvas.width = width;
          canvas.height = height;
          context.drawImage(copy, x, y, width, height, 0, 0, width, height);
        }
        if (action === 'trim') {
          const data = context.getImageData(0, 0, w, h).data;
          let left = w,
            top = h,
            right = -1,
            bottom = -1;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
              if (data[(y * w + x) * 4 + 3] > 8) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
              }
          if (right < 0) throw new Error('The image is empty. Undo the last edit before trimming.');
          canvas.width = right - left + 1;
          canvas.height = bottom - top + 1;
          context.drawImage(
            copy,
            left,
            top,
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
      }
      snapshot();
      await persist();
      say('ready', note);
    } finally {
      busy = false;
      updateButtons();
    }
  }
  for (const button of actionButtons)
    button.addEventListener('click', () => void run(button.dataset.aiAction!).catch(failure));
  window.addEventListener('offline', () => {
    say('offline', 'You are offline. Local image edits and downloads remain available.');
    updateButtons();
  });
  window.addEventListener('online', () => void refreshQuota());
  try {
    const transfer = sessionStorage.getItem('ultraclipart-ai-prompt');
    if (transfer) {
      const saved = JSON.parse(transfer);
      if (
        typeof saved.prompt === 'string' &&
        saved.prompt.length <= 1200 &&
        Date.now() - saved.createdAt < 3600000
      ) {
        prompt.value = saved.prompt;
        if (styles.some(([id]) => id === saved.style)) style.value = saved.style;
      }
      sessionStorage.removeItem('ultraclipart-ai-prompt');
    }
    // Fragment fallback is never sent to the server or used as executable markup.
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (!prompt.value && fragment.has('idea'))
      prompt.value = (fragment.get('idea') || '').slice(0, 1200);
    if (fragment.has('idea')) window.history.replaceState(null, '', location.pathname);
  } catch {
    /* Generating and downloads still work without browser storage. */
  }
  count();
  selectStyle();
  updateButtons();
  void history('read')
    .then((items) => {
      records = items;
      renderHistory();
    })
    .catch((error) => {
      element('ai-storage-note').textContent = message(error);
    });
  void refreshQuota();
}
