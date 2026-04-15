export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

export function formatRelativeTime(value) {
  if (!value) {
    return 'Not reviewed yet';
  }

  const deltaMinutes = Math.round((value - Date.now()) / (60 * 1000));
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, 'minute');
  }

  const deltaHours = Math.round(deltaMinutes / 60);

  if (Math.abs(deltaHours) < 24) {
    return formatter.format(deltaHours, 'hour');
  }

  return formatter.format(Math.round(deltaHours / 24), 'day');
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function createNotifier(container) {
  return function notify(message, tone = 'info') {
    const toast = document.createElement('div');

    toast.className = `toast toast-${tone}`;
    toast.textContent = message;
    container.append(toast);

    window.setTimeout(() => {
      toast.classList.add('toast-exit');
      window.setTimeout(() => toast.remove(), 220);
    }, 2800);
  };
}

export function isInteractiveTarget(target) {
  return Boolean(
    target instanceof HTMLElement &&
      (target.closest('input, textarea, select, button, [contenteditable="true"]') ||
        target.isContentEditable)
  );
}
