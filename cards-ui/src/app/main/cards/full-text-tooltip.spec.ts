import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { FullTextTooltipDirective } from './full-text-tooltip';

@Component({
  imports: [FullTextTooltipDirective],
  template: `<span appFullTextTooltip="1968 Topps Mets Rookies #177">1968 Topps Mets Rookies #177</span>`,
})
class Host {}

describe('FullTextTooltipDirective', () => {
  const setup = (scrollWidth: number, clientWidth: number) => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const debug = fixture.debugElement.query(By.directive(FullTextTooltipDirective));
    const element = debug.nativeElement as HTMLElement;
    Object.defineProperty(element, 'scrollWidth', { value: scrollWidth });
    Object.defineProperty(element, 'clientWidth', { value: clientWidth });
    return { element, tooltip: debug.injector.get(MatTooltip) };
  };

  it('shows the whole text when it is cut off', () => {
    const { element, tooltip } = setup(240, 180);
    expect(tooltip.message).toBe('1968 Topps Mets Rookies #177');
    expect(tooltip.disabled).toBe(true);
    element.dispatchEvent(new Event('pointerenter'));
    expect(tooltip.disabled).toBe(false);
  });

  it('shows no tooltip when the text fits', () => {
    const { element, tooltip } = setup(180, 180);
    element.dispatchEvent(new Event('focusin'));
    expect(tooltip.disabled).toBe(true);
  });
});
