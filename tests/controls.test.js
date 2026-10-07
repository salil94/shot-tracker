// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControls, formatDate, BANNER_TEXT } from '../src/ui/controls.js';

const T0 = 1_760_000_000_000;
const SHELL = `
  <span id="session-date"></span><button id="new-session"></button>
  <div id="banner" hidden><span id="banner-text"></span><button id="banner-dismiss"></button></div>
  <div id="totals"></div>
  <button data-view="current" aria-pressed="true"></button>
  <button data-view="all" aria-pressed="false"></button>
  <p id="hint" hidden></p>
  <button id="undo"></button>`;

const snapshot = (over = {}) => ({
  view: 'current',
  warning: null,
  session: { id: 's', startedAt: T0, shots: [] },
  shots: [],
  totals: { made: 0, attempts: 0, pct: null },
  canUndo: false,
  ...over,
});

describe('createControls', () => {
  let handlers;
  let controls;
  const $ = (sel) => document.querySelector(sel);

  beforeEach(() => {
    document.body.innerHTML = SHELL;
    handlers = { onNewSession: vi.fn(), onUndo: vi.fn(), onViewChange: vi.fn(), onDismissBanner: vi.fn() };
    controls = createControls(document, handlers);
  });

  it('renders date, totals, view and undo state', () => {
    controls.update(
      snapshot({ view: 'all', shots: [{}], totals: { made: 7, attempts: 12, pct: 58 }, canUndo: true }),
    );
    expect($('#session-date').textContent).toBe(formatDate(T0));
    expect($('#totals').textContent).toBe('7/12 · 58%');
    expect($('[data-view="all"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-view="current"]').getAttribute('aria-pressed')).toBe('false');
    expect($('#undo').disabled).toBe(false);
  });

  it('disables undo when there is nothing to undo', () => {
    controls.update(snapshot());
    expect($('#undo').disabled).toBe(true);
  });

  it('shows the empty-state hint only for an empty current session', () => {
    controls.update(snapshot());
    expect($('#hint').hidden).toBe(false);
    controls.update(snapshot({ shots: [{}] }));
    expect($('#hint').hidden).toBe(true);
    controls.update(snapshot({ view: 'all' }));
    expect($('#hint').hidden).toBe(true);
  });

  it('shows and hides the banner', () => {
    controls.update(snapshot({ warning: 'unavailable' }));
    expect($('#banner').hidden).toBe(false);
    expect($('#banner-text').textContent).toBe(BANNER_TEXT.unavailable);
    controls.update(snapshot());
    expect($('#banner').hidden).toBe(true);
  });

  it('uses plain punctuation in user-facing copy (no em or en dashes)', () => {
    for (const text of Object.values(BANNER_TEXT)) expect(text).not.toMatch(/[–—]/);
  });

  it('forwards clicks to handlers', () => {
    $('#new-session').click();
    $('#undo').click();
    $('[data-view="all"]').click();
    $('#banner-dismiss').click();
    expect(handlers.onNewSession).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onViewChange).toHaveBeenCalledWith('all');
    expect(handlers.onDismissBanner).toHaveBeenCalledTimes(1);
  });
});
