import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { APP_NAME } from '../app-name';

export const PANEL_STATE_STORAGE_KEY = `${APP_NAME}.panels`;

/**
 * Remembers which card panels the viewer opened or closed, by a key per panel, in this browser.
 * A panel the viewer has not touched keeps its default.
 */
@Injectable({ providedIn: 'root' })
export class PanelStateService {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<Readonly<Record<string, boolean>>>(this.read());

  isOpen(key: string, fallback: boolean): boolean {
    return this.state()[key] ?? fallback;
  }

  /** Records a panel opening or closing; one still at its default, never touched, is left out. */
  set(key: string, open: boolean, fallback: boolean): void {
    if (this.isOpen(key, fallback) === open) return;
    this.state.update((state) => ({ ...state, [key]: open }));
    try {
      this.document.defaultView?.localStorage.setItem(PANEL_STATE_STORAGE_KEY, JSON.stringify(this.state()));
    } catch (error) {
      console.warn('Could not save the open card panels', error);
    }
  }

  private read(): Record<string, boolean> {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(PANEL_STATE_STORAGE_KEY);
      if (!stored) return {};
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
      }
      console.warn('Ignoring invalid stored card panels');
    } catch (error) {
      console.warn('Could not read the open card panels', error);
    }
    return {};
  }
}
