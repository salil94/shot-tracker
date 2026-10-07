import checkIcon from '@phosphor-icons/core/bold/check-bold.svg?raw';
import xIcon from '@phosphor-icons/core/bold/x-bold.svg?raw';

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), Math.max(lo, hi));

export function placePopover(tap, size, viewport, margin = 8, offset = 16) {
  const left = clamp(tap.x - size.width / 2, margin, viewport.vw - size.width - margin);
  let top = tap.y - size.height - offset;
  if (top < margin) top = tap.y + offset;
  top = clamp(top, margin, viewport.vh - size.height - margin);
  return { left, top };
}

function makeButton(label, className, icon) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  return b;
}

export function createShotPicker(root = document.body) {
  const backdrop = document.createElement('div');
  backdrop.className = 'picker-backdrop';
  backdrop.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'picker';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Log shot');
  const make = makeButton('Make', 'make', checkIcon);
  const miss = makeButton('Miss', 'miss', xIcon);
  panel.append(make, miss);
  backdrop.append(panel);
  root.append(backdrop);

  let handlers = null;

  // Clearing handlers before calling out guarantees one resolution per open.
  function finish(kind, arg) {
    if (!handlers) return;
    const h = handlers;
    handlers = null;
    backdrop.hidden = true;
    if (kind === 'choose') h.onChoose(arg);
    else h.onCancel?.();
  }

  make.addEventListener('click', () => finish('choose', true));
  miss.addEventListener('click', () => finish('choose', false));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) finish('cancel');
  });

  return {
    element: backdrop,
    open({ clientX, clientY }, onChoose, onCancel) {
      finish('cancel');
      handlers = { onChoose, onCancel };
      backdrop.hidden = false;
      const rect = panel.getBoundingClientRect();
      const { left, top } = placePopover(
        { x: clientX, y: clientY },
        { width: rect.width, height: rect.height },
        { vw: window.innerWidth, vh: window.innerHeight },
      );
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    },
    close() {
      finish('cancel');
    },
    isOpen: () => handlers !== null,
  };
}
