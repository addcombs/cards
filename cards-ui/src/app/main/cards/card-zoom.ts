import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Card, CardSide, cardPhotoUrl } from './card.service';

export interface CardZoomData {
  card: Card;
  side: CardSide;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
const STEP = 1.5;

/**
 * A card's photo in a dialog: zoom with the buttons, the mouse wheel or a trackpad pinch, and pan by
 * dragging or scrolling. It loads the larger zoom photo, falling back to the regular one.
 */
@Component({
  selector: 'app-card-zoom',
  imports: [MatButtonModule, MatButtonToggleModule, MatDialogModule, MatIconModule, MatTooltipModule],
  templateUrl: './card-zoom.html',
  styleUrl: './card-zoom.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardZoomComponent {
  protected readonly data = inject<CardZoomData>(MAT_DIALOG_DATA);
  protected readonly side = signal(this.data.side);
  protected readonly zoom = signal(MIN_ZOOM);
  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;
  /** Sides whose zoom photo failed to load, shown from the regular photo instead. */
  private readonly missingZoomPhotos = signal<ReadonlySet<CardSide>>(new Set());
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private drag: { x: number; y: number; left: number; top: number } | null = null;

  protected photoUrl(): string {
    const side = this.side();
    return cardPhotoUrl(this.data.card, side, !this.missingZoomPhotos().has(side));
  }

  protected photoMissing(): void {
    const side = this.side();
    if (!this.missingZoomPhotos().has(side)) this.missingZoomPhotos.update((sides) => new Set(sides).add(side));
  }

  protected title(): string {
    const { year, setName, cardNumber } = this.data.card;
    return `${year} ${setName} #${cardNumber}`;
  }

  protected zoomIn(): void {
    this.zoomTo(this.zoom() * STEP);
  }

  protected zoomOut(): void {
    this.zoomTo(this.zoom() / STEP);
  }

  protected reset(): void {
    this.zoomTo(MIN_ZOOM);
  }

  protected showSide(side: CardSide): void {
    this.side.set(side);
  }

  protected wheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomTo(this.zoom() * Math.exp(-event.deltaY * 0.002), event);
  }

  protected startDrag(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.zoom() === MIN_ZOOM) return;
    const viewport = this.viewport().nativeElement;
    this.drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected moveDrag(event: PointerEvent): void {
    if (!this.drag) return;
    const viewport = this.viewport().nativeElement;
    viewport.scrollLeft = this.drag.left - (event.clientX - this.drag.x);
    viewport.scrollTop = this.drag.top - (event.clientY - this.drag.y);
  }

  protected endDrag(): void {
    this.drag = null;
  }

  protected dragging(): boolean {
    return this.drag !== null;
  }

  /** Zooms keeping the point under the pointer (or the middle of the view) in place. */
  private zoomTo(level: number, at?: { clientX: number; clientY: number }): void {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(level * 100) / 100));
    const previous = this.zoom();
    if (next === previous) return;
    const viewport = this.viewport().nativeElement;
    const box = viewport.getBoundingClientRect();
    const x = at ? at.clientX - box.left : viewport.clientWidth / 2;
    const y = at ? at.clientY - box.top : viewport.clientHeight / 2;
    const ratio = next / previous;
    const left = (viewport.scrollLeft + x) * ratio - x;
    const top = (viewport.scrollTop + y) * ratio - y;
    this.zoom.set(next);
    requestAnimationFrame(() => {
      viewport.scrollLeft = left;
      viewport.scrollTop = top;
    });
  }
}
