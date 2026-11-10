import { ChangeDetectionStrategy, Component } from '@angular/core';

export interface PixelLayer {
  tone: 'primary' | 'secondary';
  opacity: number;
  d: string;
}

const CELL = 4;
const GAP = 1;
const COLUMNS = 300;
const ROWS = 30;
const OPACITIES = [0.1, 0.18, 0.27, 0.36];

/** Small deterministic PRNG so the pattern is identical on every render and in tests. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a pixel mosaic that is sparse on the left (behind the title) and denser to the right.
 * Cells are grouped into one path per tone and opacity to keep the DOM small.
 */
export function buildPixelLayers(seed = 26): PixelLayer[] {
  const next = random(seed);
  const paths = new Map<string, string[]>();
  for (let column = 0; column < COLUMNS; column++) {
    const density = Math.pow(column / (COLUMNS - 1), 1.4);
    for (let row = 0; row < ROWS; row++) {
      if (next() > density) continue;
      const tone = Math.sin(column / 21 + row / 7.5) > 0.15 ? 'secondary' : 'primary';
      const level = Math.min(OPACITIES.length - 1, Math.floor(next() * OPACITIES.length));
      const key = `${tone}:${level}`;
      const size = CELL - GAP;
      const cell = `M${column * CELL} ${row * CELL}h${size}v${size}h-${size}z`;
      paths.set(key, [...(paths.get(key) ?? []), cell]);
    }
  }
  return [...paths.entries()]
    .map(([key, cells]) => {
      const [tone, level] = key.split(':');
      return { tone: tone as PixelLayer['tone'], opacity: OPACITIES[Number(level)], d: cells.join('') };
    })
    .sort((a, b) => a.opacity - b.opacity || a.tone.localeCompare(b.tone));
}

const LAYERS = buildPixelLayers();

/** The width of the solid end, in CSS pixels, pinned to the right whatever the bar's width. */
export const SOLID_WIDTH = 200;
/** How far into the solid end, as a fraction of it, every cell is filled. */
const SOLID_FULL = 0.45;

/**
 * Builds the solid primary end: full-size cells drawn edge to edge, a few at its left edge, more and
 * more, then all of them, so the mosaic turns to solid colour behind the buttons on the right.
 */
export function buildSolidEnd(seed = 27): string {
  const next = random(seed);
  const columns = SOLID_WIDTH / CELL;
  const cells: string[] = [];
  for (let column = 0; column < columns; column++) {
    const x = Math.min(1, column / (columns * SOLID_FULL));
    const density = x * x * (3 - 2 * x);
    for (let row = 0; row < ROWS; row++) {
      if (next() < density) cells.push(`M${column * CELL} ${row * CELL}h${CELL}v${CELL}h-${CELL}z`);
    }
  }
  return cells.join('');
}

const SOLID_END = buildSolidEnd();

/**
 * Decorative toolbar and footer background drawn inline so it follows the live theme: cells are filled
 * with the Material primary and secondary system colors, so light/dark mode and the brightness
 * slider recolor it without regenerating an image. The mosaic ends in solid primary at the right.
 */
@Component({
  selector: 'app-toolbar-background',
  template: `
    <svg
      viewBox="0 0 1200 120"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      @for (layer of layers; track $index) {
        <path [class]="layer.tone" [attr.fill-opacity]="layer.opacity" [attr.d]="layer.d" />
      }
    </svg>
    <svg
      class="solid-end"
      [style.width.px]="solidWidth"
      [attr.viewBox]="'0 0 ' + solidWidth + ' 120'"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <path class="primary" [attr.d]="solidEnd" />
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .solid-end {
      position: absolute;
      top: 0;
      right: 0;
    }
    .primary {
      fill: var(--mat-sys-primary);
    }
    .secondary {
      fill: var(--mat-sys-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarBackgroundComponent {
  protected readonly layers = LAYERS;
  protected readonly solidEnd = SOLID_END;
  protected readonly solidWidth = SOLID_WIDTH;
}
