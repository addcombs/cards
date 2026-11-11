import { TestBed } from '@angular/core/testing';
import { PANEL_STATE_STORAGE_KEY, PanelStateService } from './panel-state.service';

describe('PanelStateService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps defaults until a panel is opened or closed, then remembers it', () => {
    const panels = TestBed.inject(PanelStateService);
    expect(panels.isOpen('Baseball/Sold', true)).toBe(true);
    panels.set('Baseball/Sold', true, true);
    expect(localStorage.getItem(PANEL_STATE_STORAGE_KEY)).toBeNull();

    panels.set('Baseball/Sold', false, true);
    panels.set('Baseball/Sold/PSA MINT 9', true, false);
    panels.set('Baseball/Sold/Ungraded', true, false);
    expect(panels.isOpen('Baseball/Sold', true)).toBe(false);
    expect(JSON.parse(localStorage.getItem(PANEL_STATE_STORAGE_KEY)!)).toEqual({
      'Baseball/Sold': false,
      'Baseball/Sold/PSA MINT 9': true,
      'Baseball/Sold/Ungraded': true,
    });

    TestBed.resetTestingModule();
    expect(TestBed.inject(PanelStateService).isOpen('Baseball/Sold/Ungraded', false)).toBe(true);
  });

  it('ignores stored state that is not a map of panels to true or false', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(PANEL_STATE_STORAGE_KEY, '[true]');
    expect(TestBed.inject(PanelStateService).isOpen('Baseball/Sold', true)).toBe(true);
    expect(warn).toHaveBeenCalled();

    TestBed.resetTestingModule();
    localStorage.setItem(PANEL_STATE_STORAGE_KEY, '{"Baseball/Sold": false, "Hockey/Sold": "yes"}');
    const panels = TestBed.inject(PanelStateService);
    expect(panels.isOpen('Baseball/Sold', true)).toBe(false);
    expect(panels.isOpen('Hockey/Sold', true)).toBe(true);
  });
});
