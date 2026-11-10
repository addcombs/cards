import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';

export interface PixelLayer {
  opacity: number;
  d: string;
}

/** Each pixel's size in CSS pixels; they are drawn edge to edge so the right end is solid crimson. */
export const CELL = 2;
/**
 * The fractions of the width where the pixels start, after the white behind the title, and where every
 * pixel is filled. Narrow bars, where the title takes most of the width, keep more white and turn to
 * crimson in a shorter band just before the buttons.
 */
function band(width: number): { start: number; end: number } {
  return width < 600 ? { start: 0.56, end: 0.68 } : { start: 0.2, end: 0.92 };
}

/** A stable 0-1 value per cell, so a resize adds or drops cells at the edges without reshuffling the rest. */
function hash(column: number, row: number, seed: number): number {
  let t = Math.imul(column, 0x27d4eb2d) ^ Math.imul(row, 0x165667b1) ^ seed;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Builds the pixels for a bar `width` by `height` CSS pixels: none on the left, then more and more to
 * the right until they fill it. A few faded pixels run ahead of the solid ones to soften the edge.
 * Neighbouring pixels of a kind in a row are drawn as one strip, which keeps the paths short.
 */
export function buildPixelLayers(width: number, height: number, seed = 26): PixelLayer[] {
  const columns = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const { start, end } = band(width);
  const densities = Array.from({ length: columns }, (_, column) => {
    const x = Math.min(1, Math.max(0, ((column + 0.5) / columns - start) / (end - start)));
    return x * x * (3 - 2 * x);
  });
  const solid: string[] = [];
  const faded: string[] = [];
  for (let row = 0; row < rows; row++) {
    let kind: string[] | null = null;
    let from = 0;
    for (let column = 0; column <= columns; column++) {
      const r = column < columns ? hash(column, row, seed) : 1;
      const density = densities[column] ?? 0;
      const next = r < density ? solid : r < density * 1.4 ? faded : null;
      if (next === kind) continue;
      if (kind) {
        const length = (column - from) * CELL;
        kind.push(`M${from * CELL} ${row * CELL}h${length}v${CELL}h-${length}z`);
      }
      kind = next;
      from = column;
    }
  }
  return [
    { opacity: 0.35, d: faded.join('') },
    { opacity: 1, d: solid.join('') },
  ].filter((layer) => layer.d);
}

/**
 * Decorative toolbar and footer background: white turning to crimson through pixels, from left to
 * right. The pixels are laid out for the bar's actual size, so they stay square at any width.
 */
@Component({
  selector: 'app-toolbar-background',
  template: `
    <svg [attr.viewBox]="viewBox()" aria-hidden="true" focusable="false">
      @for (layer of layers(); track layer.opacity) {
        <path [attr.fill-opacity]="layer.opacity" [attr.d]="layer.d" />
      }
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background: #fff;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    path {
      fill: #dc143c;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarBackgroundComponent {
  private readonly size = signal({ width: 1200, height: 120 });
  protected readonly viewBox = computed(() => `0 0 ${this.size().width} ${this.size().height}`);
  protected readonly layers = computed(() => buildPixelLayers(this.size().width, this.size().height));

  constructor() {
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (width && height) this.size.set({ width, height });
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
