import { TestBed } from '@angular/core/testing';
import { CELL, ToolbarBackgroundComponent, buildPixelLayers } from './toolbar-background';

describe('ToolbarBackgroundComponent', () => {
  it('renders a decorative SVG hidden from assistive technology', () => {
    const fixture = TestBed.createComponent(ToolbarBackgroundComponent);
    fixture.detectChanges();
    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('is deterministic, white on the left and solid on the right', () => {
    expect(buildPixelLayers(1200, 120)).toEqual(buildPixelLayers(1200, 120));
    const columnsOf = (opacity: number) => (buildPixelLayers(1200, 120).find((layer) => layer.opacity === opacity)?.d.match(/M\d+ /g) ?? [])
      .map((cell) => Number(cell.slice(1)) / CELL);
    const solid = columnsOf(1);
    // Nothing behind the title, and every pixel filled in the last columns.
    expect(Math.min(...solid, ...columnsOf(0.35))).toBeGreaterThanOrEqual(0.2 * 200 - 1);
    const rows = 120 / CELL;
    for (const column of [195, 196, 197, 198, 199]) {
      expect(solid.filter((c) => c === column).length).toBe(rows);
    }
  });

  it('lays out square pixels for the bar\'s width', () => {
    const cells = (width: number) => buildPixelLayers(width, 60).flatMap((layer) => layer.d.match(/M\d+ /g) ?? []);
    const widest = (width: number) => Math.max(...cells(width).map((cell) => Number(cell.slice(1))));
    expect(widest(360)).toBe(360 - CELL);
    expect(widest(1500)).toBe(1500 - CELL);
  });
});
