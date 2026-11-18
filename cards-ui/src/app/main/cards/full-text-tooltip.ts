import { Directive, ElementRef, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * Shows an element's whole text in a tooltip when it is cut off with an ellipsis
 * (`text-overflow: ellipsis`), and no tooltip when it fits.
 */
@Directive({
  selector: '[appFullTextTooltip]',
  hostDirectives: [{ directive: MatTooltip, inputs: ['matTooltip: appFullTextTooltip'] }],
  // Pointer and focus events come before the tooltip's own mouseenter and focus handlers.
  host: {
    '(pointerenter)': 'checkOverflow()',
    '(focusin)': 'checkOverflow()',
  },
})
export class FullTextTooltipDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly tooltip = inject(MatTooltip);

  constructor() {
    this.tooltip.disabled = true;
  }

  protected checkOverflow(): void {
    this.tooltip.disabled = this.element.scrollWidth <= this.element.clientWidth;
  }
}
