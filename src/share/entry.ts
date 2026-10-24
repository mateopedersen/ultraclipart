import './trigger.css';
document.addEventListener('click', async (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('[data-share-art]')
      : null;
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    const { openShare } = await import('./client');
    await openShare({
      trigger: button,
      kind: 'catalog',
      title: button.dataset.shareTitle || 'Clipart',
      url: button.dataset.shareUrl,
      imageUrl: button.dataset.shareImage,
    });
  } catch {
    button.setAttribute('title', 'Sharing could not load. Please try again.');
  } finally {
    button.disabled = false;
  }
});
