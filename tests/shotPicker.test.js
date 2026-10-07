// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { placePopover, createShotPicker } from '../src/ui/shotPicker.js';

const SIZE = { width: 160, height: 72 };
const PHONE = { vw: 390, vh: 844 };

// Review Focus #1: popover stays fully on screen near edges.
describe('placePopover', () => {
  it('centres above the tap when there is room', () => {
    expect(placePopover({ x: 200, y: 400 }, SIZE, PHONE)).toEqual({ left: 120, top: 312 });
  });
  it('clamps to the left edge', () => {
    expect(placePopover({ x: 10, y: 400 }, SIZE, PHONE).left).toBe(8);
  });
  it('clamps to the right edge', () => {
    expect(placePopover({ x: 385, y: 400 }, SIZE, PHONE).left).toBe(222);
  });
  it('flips below the tap near the top', () => {
    expect(placePopover({ x: 200, y: 40 }, SIZE, PHONE).top).toBe(56);
  });
  it('clamps vertically in a very short viewport', () => {
    expect(placePopover({ x: 200, y: 30 }, SIZE, { vw: 390, vh: 100 }).top).toBe(20);
  });
});

describe('createShotPicker', () => {
  let picker;
  let onChoose;
  let onCancel;
  const button = (name) => picker.element.querySelector(`.${name}`);

  beforeEach(() => {
    document.body.innerHTML = '';
    picker = createShotPicker(document.body);
    onChoose = vi.fn();
    onCancel = vi.fn();
  });

  it('is hidden until opened', () => {
    expect(picker.element.hidden).toBe(true);
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    expect(picker.element.hidden).toBe(false);
    expect(picker.isOpen()).toBe(true);
  });

  it('labels buttons with text plus a decorative icon', () => {
    expect(button('make').textContent.trim()).toBe('Make');
    expect(button('miss').textContent.trim()).toBe('Miss');
    expect(button('make').querySelector('.icon[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('reports Make as true and closes', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('make').click();
    expect(onChoose).toHaveBeenCalledWith(true);
    expect(picker.isOpen()).toBe(false);
    expect(picker.element.hidden).toBe(true);
  });

  it('reports Miss as false', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('miss').click();
    expect(onChoose).toHaveBeenCalledWith(false);
  });

  // Review Focus #2: a double-tap logs exactly one shot.
  it('resolves only once on a rapid double tap', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    button('make').click();
    button('make').click();
    button('miss').click();
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('cancels when the backdrop is tapped', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    picker.element.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(picker.isOpen()).toBe(false);
  });

  it('cancels the previous shot if reopened', () => {
    picker.open({ clientX: 100, clientY: 100 }, onChoose, onCancel);
    const second = vi.fn();
    picker.open({ clientX: 50, clientY: 50 }, second, vi.fn());
    expect(onCancel).toHaveBeenCalledTimes(1);
    button('make').click();
    expect(second).toHaveBeenCalledWith(true);
    expect(onChoose).not.toHaveBeenCalled();
  });
});
