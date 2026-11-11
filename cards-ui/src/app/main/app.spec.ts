import { BreakpointObserver } from '@angular/cdk/layout';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog, MatDialogState } from '@angular/material/dialog';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from '../auth/auth.service';
import { AccountService, AccountDetails } from './account/account.service';
import { ApiStatusService } from './api-status/api-status.service';
import { Card, CardService } from './cards/card.service';
import { PANEL_STATE_STORAGE_KEY } from './cards/panel-state.service';
import { PROJECT_SETTINGS } from '../project.settings';
import { BRIGHTNESS_STORAGE_KEY } from '../theme/theme.service';

describe('App', () => {
  const auth = {
    status: signal<'loading' | 'notConfigured' | 'signedOut' | 'signedIn' | 'invalid'>('signedIn'),
    firstName: signal(''),
    email: signal('user@example.com'),
    error: signal(''),
    busy: signal(false),
    isAdmin: signal(false),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  const account = {
    state: signal<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('ready'),
    details: signal<AccountDetails | null>(null),
    editing: signal(false),
    saving: signal(false),
    error: signal(''),
    load: vi.fn(),
    open: vi.fn(() => account.editing.set(true)),
    cancel: vi.fn(() => account.editing.set(false)),
    reset: vi.fn(),
    save: vi.fn(),
  };
  const apiStatus = { status: signal<'checking' | 'up' | 'down'>('checking') };
  const card = (photoId: string, sport: string, player: string, variety: string | null = null): Card => ({
    photoId, certNumber: photoId, sport, year: 1992, setName: 'Topps Gold', cardNumber: '141', player, variety,
    grade: 'EX-MT 6', ebayUrl: null,
  });
  /** Opens every card panel in the selected sport's tab by its header, groups first and then the grades they reveal. */
  const expandAll = async (fixture: ComponentFixture<App>) => {
    let closed: HTMLElement[];
    while ((closed = Array.from(fixture.nativeElement.querySelectorAll('mat-expansion-panel-header[aria-expanded="false"]'))).length) {
      for (const header of closed) header.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  const cards = {
    state: signal<'idle' | 'loading' | 'ready' | 'error'>('ready'),
    cards: signal<Card[]>([]),
    error: signal(''),
    saving: signal(false),
    saveError: signal(''),
    load: vi.fn(),
    reset: vi.fn(),
    save: vi.fn(async () => true),
    clearSaveError: vi.fn(),
  };

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark-theme');
    auth.status.set('signedIn');
    auth.error.set('');
    auth.firstName.set('');
    auth.busy.set(false);
    auth.isAdmin.set(false);
    account.state.set('ready');
    account.details.set(null);
    account.editing.set(false);
    account.saving.set(false);
    account.error.set('');
    apiStatus.status.set('checking');
    cards.state.set('ready');
    cards.cards.set([]);
    cards.error.set('');
    cards.saving.set(false);
    cards.saveError.set('');
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: BreakpointObserver, useValue: { observe: () => of({ matches: true }) } },
        { provide: AuthService, useValue: auth },
        { provide: AccountService, useValue: account },
        { provide: ApiStatusService, useValue: apiStatus },
        { provide: CardService, useValue: cards },
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      ],
    }).compileComponents();
  });

  it('starts with the sidenav closed', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-controls="app-sidenav"]');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('credits the developer in the footer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const credit: HTMLElement = fixture.nativeElement.querySelector('footer.app-footer .app-credit');
    expect(credit.textContent?.trim()).toBe('Developed by Adam Combs');
    const name = credit.querySelector('a.app-credit-name') as HTMLAnchorElement;
    expect(name.textContent).toBe('Adam Combs');
    expect(name.href).toBe('https://acombs-dev.com/');
  });

  it('links the sidenav logos to PSA and eBay in new tabs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const links = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('mat-sidenav .site-links a'));
    expect(links.map((link) => [link.href, link.target, link.querySelector('img')!.alt])).toEqual([
      ['https://www.psacard.com/', '_blank', 'PSA (opens in a new tab)'],
      ['https://www.ebay.com/', '_blank', 'eBay (opens in a new tab)'],
    ]);
  });

  it('shows the current API health in the footer, not the toolbar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const icon: HTMLElement = fixture.nativeElement.querySelector('footer.app-footer .api-status');
    expect(icon).toBeTruthy();
    expect(fixture.nativeElement.querySelector('mat-toolbar .api-status')).toBeNull();
    expect(icon.getAttribute('aria-label')).toBe('Checking API status');
    expect(icon.textContent?.trim()).toBe('cloud_queue');
    // The label and icon link to the API's Swagger docs in a new tab.
    const link = icon.closest('a.api-link') as HTMLAnchorElement;
    expect(link.href).toMatch(/\/swagger-ui\.html$/);
    expect(link.target).toBe('_blank');
    expect(link.textContent).toContain('API');

    apiStatus.status.set('up');
    fixture.detectChanges();
    expect(icon.getAttribute('aria-label')).toBe('API is up');
    expect(icon.textContent?.trim()).toBe('cloud_done');

    apiStatus.status.set('down');
    fixture.detectChanges();
    expect(icon.getAttribute('aria-label')).toBe('API is unreachable');
    expect(icon.textContent?.trim()).toBe('cloud_off');
  });

  it('shows baseball, basketball, football, and hockey tabs, each with no cards yet', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const tabs: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Baseball', 'Basketball', 'Football', 'Hockey']);
    for (const tab of tabs) {
      tab.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const label = tab.textContent!.trim();
      const panel = fixture.nativeElement.querySelector(`section.sport-panel[aria-label="${label} cards"]`);
      expect(panel?.textContent?.trim()).toBe(`No ${label.toLowerCase()} cards yet.`);
    }
  });

  it('puts each card in its sport tab and flips it to the back when clicked', async () => {
    cards.cards.set([
      card('94481237', 'Basketball', 'Michael Jordan'),
      card('97041266', 'Baseball', 'Derek Jeter', 'Rookie'),
      card('94481240', 'Basketball', 'Kobe Bryant'),
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    const players = (label: string): string[] => Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll(`section.sport-panel[aria-label="${label} cards"] .card-player`),
    ).map((player) => player.textContent!.trim());
    expect(players('Baseball')).toEqual(['Derek Jeter']);
    const baseball: HTMLElement = fixture.nativeElement.querySelector('section.sport-panel[aria-label="Baseball cards"]');
    const lines = (side: string) => Array.from<HTMLElement>(baseball.querySelectorAll(`.card-label-${side} > span`)).map((line) => line.textContent!.trim());
    expect(lines('left')).toEqual(['1992 Topps Gold', 'Rookie', 'Derek Jeter']);
    expect(lines('right')).toEqual(['#141', 'Ex-Mt', '6']);
    // The cert number links to PSA's page for it.
    const cert: HTMLAnchorElement = baseball.querySelector('.card-label-right > a.card-cert')!;
    expect(cert.textContent!.replace(/\s+/g, ' ').trim()).toBe('PSA cert 97041266 (opens in a new tab)');
    expect(cert.href).toBe('https://www.psacard.com/cert/97041266/psa');
    expect(cert.target).toBe('_blank');
    expect(cert.rel).toBe('noopener');
    expect(baseball.querySelector('.grade-group-title')?.textContent?.trim()).toBe('PSA EX-MT 6');

    const tabs: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]'));
    tabs[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    expect(players('Basketball')).toEqual(['Michael Jordan', 'Kobe Bryant']);
    const [photo, otherPhoto] = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('section.sport-panel[aria-label="Basketball cards"] .card-photo'),
    );
    const [front, back] = Array.from<HTMLImageElement>(photo.querySelectorAll('img'));
    expect(front.getAttribute('src')).toBe(`${PROJECT_SETTINGS.photosUrl}94481237/front.jpg`);
    expect(back.getAttribute('src')).toBe(`${PROJECT_SETTINGS.photosUrl}94481237/back.jpg`);
    expect(front.alt).toBe('Front of Michael Jordan, 1992 Topps Gold #141');
    expect(back.getAttribute('aria-hidden')).toBe('true');
    const flip = photo.querySelector('button.card-flip') as HTMLButtonElement;
    expect(flip.contains(front)).toBe(true);
    expect(flip.getAttribute('aria-pressed')).toBe('false');
    expect(flip.getAttribute('aria-label')).toBe('Flip Michael Jordan, 1992 Topps Gold #141 to the back');

    flip.click();
    fixture.detectChanges();
    expect(photo.classList).toContain('flipped');
    expect(flip.getAttribute('aria-pressed')).toBe('true');
    expect(flip.getAttribute('aria-label')).toBe('Flip Michael Jordan, 1992 Topps Gold #141 to the front');
    expect(front.getAttribute('aria-hidden')).toBe('true');
    expect(back.getAttribute('aria-hidden')).toBe('false');
    expect(otherPhoto.classList).not.toContain('flipped');

    flip.click();
    fixture.detectChanges();
    expect(photo.classList).not.toContain('flipped');
  });

  it('zooms a card in a dialog, starting on the side showing', async () => {
    cards.cards.set([card('97041266', 'Baseball', 'Derek Jeter')]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    (fixture.nativeElement.querySelector('button.card-flip') as HTMLButtonElement).click();
    fixture.detectChanges();
    const zoom = fixture.nativeElement.querySelector('button.card-zoom') as HTMLButtonElement;
    expect(zoom.textContent?.trim()).toBe('zoom_in');
    expect(zoom.getAttribute('aria-label')).toBe('Zoom Derek Jeter, 1992 Topps Gold #141');
    zoom.click();
    fixture.detectChanges();

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const photo = () => dialog.querySelector('img.zoom-photo') as HTMLImageElement;
    const button = (label: string) => dialog.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    expect(photo().getAttribute('src')).toBe(`${PROJECT_SETTINGS.photosUrl}97041266/back-zoom.jpg`);
    expect(photo().alt).toBe('Back of Derek Jeter, 1992 Topps Gold #141');
    expect(photo().style.height).toBe('100%');
    expect(button('Zoom out').disabled).toBe(true);

    button('Zoom in').click();
    fixture.detectChanges();
    expect(photo().style.height).toBe('150%');
    expect(button('Fit to window').textContent?.trim()).toBe('150%');
    for (let i = 0; i < 5; i++) button('Zoom in').click();
    fixture.detectChanges();
    expect(photo().style.height).toBe('400%');
    expect(button('Zoom in').disabled).toBe(true);
    button('Fit to window').click();
    fixture.detectChanges();
    expect(photo().style.height).toBe('100%');

    // A missing zoom photo falls back to the regular one.
    photo().dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(photo().getAttribute('src')).toBe(`${PROJECT_SETTINGS.photosUrl}97041266/back.jpg`);
    (Array.from(dialog.querySelectorAll('mat-button-toggle button')) as HTMLButtonElement[])[0].click();
    fixture.detectChanges();
    expect(photo().getAttribute('src')).toBe(`${PROJECT_SETTINGS.photosUrl}97041266/front-zoom.jpg`);
  });

  it('shows the cards listed on eBay first and the sold ones after, both open, linking to the listings', async () => {
    cards.cards.set([
      card('94481237', 'Baseball', 'Dave Parker'),
      { ...card('97041266', 'Baseball', 'Derek Jeter'), ebayUrl: 'https://www.ebay.com/itm/123' },
      card('98318134', 'Baseball', 'George Brett'),
      card('94481240', 'Basketball', 'Kobe Bryant'),
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    const baseball: HTMLElement = fixture.nativeElement.querySelector('section.sport-panel[aria-label="Baseball cards"]');
    const contents = Array.from<HTMLElement>(baseball.querySelectorAll('.sport-group-title, .card-player')).map((el) => el.textContent!.trim());
    expect(contents).toEqual(['Current eBay Listings', 'Derek Jeter', 'Sold', 'Dave Parker', 'George Brett']);
    const headers = Array.from<HTMLElement>(baseball.querySelectorAll('.sport-group > mat-expansion-panel-header'));
    expect(headers.map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
    expect(headers[1].textContent).toContain('2 cards');
    // Only the sold cards are stamped.
    const stamped = Array.from<HTMLElement>(baseball.querySelectorAll('figure.sport-card'))
      .filter((figure) => figure.querySelector('.card-sold'))
      .map((figure) => figure.querySelector('.card-player')!.textContent!.trim());
    expect(stamped).toEqual(['Dave Parker', 'George Brett']);
    const links = Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a.card-ebay'));
    expect(links.map((link) => link.href)).toEqual(['https://www.ebay.com/itm/123']);
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toBe('noopener');
    expect(links[0].textContent).toContain('eBay listing');

    // A sport with nothing listed has only the Sold panel.
    (fixture.nativeElement.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const basketball: HTMLElement = fixture.nativeElement.querySelector('section.sport-panel[aria-label="Basketball cards"]');
    expect(Array.from<HTMLElement>(basketball.querySelectorAll('.sport-group-title')).map((h) => h.textContent!.trim())).toEqual(['Sold']);
  });

  it('splits each group by grade, highest first, with the sold cards\' grades closed at first', async () => {
    cards.cards.set([
      { ...card('1', 'Baseball', 'Dave Parker'), grade: 'NM-MT 8' },
      { ...card('2', 'Baseball', 'Derek Jeter'), grade: 'MINT 9' },
      { ...card('3', 'Baseball', 'George Brett'), grade: 'NM-MT 8' },
      { ...card('4', 'Baseball', 'Nolan Ryan'), grade: null },
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const sold: HTMLElement = fixture.nativeElement.querySelector('section.sport-panel[aria-label="Baseball cards"] .sport-group');
    const grades = () => Array.from<HTMLElement>(sold.querySelectorAll('.grade-group')).map((group) => ({
      title: group.querySelector('.grade-group-title')!.textContent!.trim(),
      count: group.querySelector('mat-panel-description .count-pill')!.textContent!.trim(),
      open: group.querySelector('mat-expansion-panel-header')!.getAttribute('aria-expanded'),
      players: Array.from(group.querySelectorAll('.card-player')).map((player) => player.textContent!.trim()),
    }));
    // A closed grade's cards are only built once it is opened.
    expect(grades()).toEqual([
      { title: 'PSA MINT 9', count: '1 card', open: 'false', players: [] },
      { title: 'PSA NM-MT 8', count: '2 cards', open: 'false', players: [] },
      { title: 'Ungraded', count: '1 card', open: 'false', players: [] },
    ]);
    await expandAll(fixture);
    expect(grades()).toEqual([
      { title: 'PSA MINT 9', count: '1 card', open: 'true', players: ['Derek Jeter'] },
      { title: 'PSA NM-MT 8', count: '2 cards', open: 'true', players: ['Dave Parker', 'George Brett'] },
      { title: 'Ungraded', count: '1 card', open: 'true', players: ['Nolan Ryan'] },
    ]);
    // Each label shows its grade's name over its number, and an ungraded card's shows neither.
    const labelGrades = Array.from<HTMLElement>(sold.querySelectorAll('.card-label-right'))
      .map((label) => Array.from(label.querySelectorAll('.card-grade-name, .card-grade-number')).map((el) => el.textContent!.trim()));
    expect(labelGrades).toEqual([['Mint', '9'], ['Nm-Mt', '8'], ['Nm-Mt', '8'], []]);
  });

  it('remembers which panels were opened and closed on the next visit', async () => {
    cards.cards.set([
      { ...card('1', 'Baseball', 'Derek Jeter'), ebayUrl: 'https://www.ebay.com/itm/1' },
      card('2', 'Baseball', 'Dave Parker'),
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const open = (f: ComponentFixture<App>) => Array.from<HTMLElement>(f.nativeElement.querySelectorAll('mat-expansion-panel-header'))
      .map((header) => header.getAttribute('aria-expanded'));
    // Each group followed by its grade: the listed cards' grade open, the sold cards' closed.
    expect(open(fixture)).toEqual(['true', 'true', 'true', 'false']);
    // Panels left at their defaults are not stored.
    expect(localStorage.getItem(PANEL_STATE_STORAGE_KEY)).toBeNull();

    await expandAll(fixture);
    expect(open(fixture)).toEqual(['true', 'true', 'true', 'true']);
    (fixture.nativeElement.querySelectorAll('mat-expansion-panel-header')[1] as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(open(fixture)).toEqual(['true', 'false', 'true', 'true']);
    fixture.destroy();

    const again = TestBed.createComponent(App);
    again.detectChanges();
    await again.whenStable();
    expect(open(again)).toEqual(['true', 'false', 'true', 'true']);
  });

  it('lets only admins edit a card, saving trimmed details and closing on success', async () => {
    cards.cards.set([card('97041266', 'Baseball', 'Derek Jeter', 'Rookie')]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    expect(fixture.nativeElement.querySelector('button.card-edit')).toBeNull();

    auth.isAdmin.set(true);
    fixture.detectChanges();
    const edit: HTMLButtonElement = fixture.nativeElement.querySelector('button.card-edit');
    expect(edit.getAttribute('aria-label')).toBe('Edit Derek Jeter, 1992 Topps Gold #141');
    edit.click();
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const input = (name: string) => dialog.querySelector(`input[formControlName="${name}"]`) as HTMLInputElement;
    expect(input('player').value).toBe('Derek Jeter');
    expect(input('variety').value).toBe('Rookie');
    const save = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Save'))!;
    expect(save.disabled).toBe(true);

    input('player').value = ' Derek Sanderson Jeter ';
    input('variety').value = '  ';
    for (const name of ['player', 'variety']) input(name).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(false);
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(cards.save).toHaveBeenCalledWith('97041266', {
      player: 'Derek Sanderson Jeter', sport: 'Baseball', year: 1992, setName: 'Topps Gold', cardNumber: '141',
      variety: null, grade: 'EX-MT 6', certNumber: '97041266', ebayUrl: null,
    });
    await fixture.whenStable();
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  });

  it('keeps the card dialog open with the error when saving fails', async () => {
    auth.isAdmin.set(true);
    cards.cards.set([card('97041266', 'Baseball', 'Derek Jeter')]);
    cards.save.mockImplementationOnce(async () => {
      cards.saveError.set('Another card already has this cert number.');
      return false;
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    await expandAll(fixture);
    (fixture.nativeElement.querySelector('button.card-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const grade = dialog.querySelector('input[formControlName="grade"]') as HTMLInputElement;
    grade.value = 'MINT 9';
    grade.dispatchEvent(new Event('input'));
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Another card already has this cert number.');
  });

  it('loads the cards on sign-in and offers a retry when loading fails', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(cards.load).toHaveBeenCalledOnce();
    cards.state.set('error');
    cards.error.set('Could not load the cards. Please try again.');
    fixture.detectChanges();
    const panel: HTMLElement = fixture.nativeElement.querySelector('section.sport-panel[aria-label="Baseball cards"]');
    expect(panel.querySelector('[role="alert"]')?.textContent?.trim()).toBe('Could not load the cards. Please try again.');
    panel.querySelector<HTMLButtonElement>('button')!.click();
    expect(cards.load).toHaveBeenCalledTimes(2);
  });

  it('selects sport tabs from the side menu', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const navItems: HTMLElement[] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('mat-nav-list:not(.site-links) a[mat-list-item]'));
    expect(navItems.map((item) => item.querySelector('[matListItemTitle]')?.textContent?.trim()))
      .toEqual(['Baseball', 'Basketball', 'Football', 'Hockey']);
    expect(navItems.map((item) => item.querySelector('[matListItemIcon]')?.textContent?.trim()))
      .toEqual(['sports_baseball', 'sports_basketball', 'sports_football', 'sports_hockey']);
    navItems[2].click();
    fixture.detectChanges();
    await fixture.whenStable();
    // The toolbar logo shows the selected sport's ball.
    expect(fixture.nativeElement.querySelector('mat-toolbar img.app-logo').getAttribute('src')).toBe('images/logos/logo-football.svg');
    const selected = fixture.nativeElement.querySelector('[role="tab"][aria-selected="true"]');
    expect(selected?.textContent?.trim()).toBe('Football');
    expect(navItems[2].getAttribute('aria-current')).toBe('page');
    expect(navItems[0].hasAttribute('aria-current')).toBe(false);
    expect(fixture.nativeElement.querySelector('section.sport-panel[aria-label="Football cards"]')).not.toBeNull();
  });

  it('toggles the sidenav from the hamburger button', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-controls="app-sidenav"]');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the sidenav from its toolbar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-label="Toggle navigation menu"]');
    toggle.click();
    fixture.detectChanges();
    const close: HTMLButtonElement = fixture.nativeElement.querySelector('mat-sidenav button[aria-label="Close navigation menu"]');
    expect(fixture.nativeElement.querySelector('mat-sidenav mat-toolbar').textContent).toContain('Menu');
    close.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses an overlay sidenav on narrow screens', async () => {
    TestBed.overrideProvider(BreakpointObserver, { useValue: { observe: () => of({ matches: false }) } });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav.classList.contains('mat-drawer-side')).toBe(false);
    expect(sidenav.classList.contains('mat-sidenav-fixed')).toBe(true);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-controls="app-sidenav"]');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await vi.waitFor(() => expect(document.activeElement).toBe(sidenav.querySelector('h2')));
  });

  it('hides the slider until the brightness icon is clicked and toggles it closed', () => {
    localStorage.setItem(BRIGHTNESS_STORAGE_KEY, '100');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-label="Adjust brightness"]');
    const control: HTMLElement = fixture.nativeElement.querySelector('.brightness-control');
    expect(toggle.querySelector('mat-icon')?.textContent?.trim()).toBe('light_mode');
    expect(control.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(control.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(BRIGHTNESS_STORAGE_KEY)).toBe('100');
    toggle.click();
    fixture.detectChanges();
    expect(control.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('adjusts brightness from an unlabeled horizontal slider before the theme button', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const control: HTMLElement = fixture.nativeElement.querySelector('.brightness-control');
    (control.nextElementSibling as HTMLButtonElement).click();
    fixture.detectChanges();
    const slider: HTMLInputElement = control.querySelector('input[type="range"]')!;
    expect(slider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(slider.getAttribute('aria-label')).toBe('Brightness');
    expect(control.textContent?.trim()).toBe('');
    expect(control.nextElementSibling?.getAttribute('aria-label')).toBe('Adjust brightness');
    for (const level of [0, 25, 50, 75, 100]) {
      slider.value = String(level);
      slider.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(slider.getAttribute('aria-valuetext')).toBe(`${level}% brightness`);
      expect(document.documentElement.getAttribute('data-brightness')).toBe(String(level));
      expect(control.nextElementSibling?.querySelector('mat-icon')?.textContent?.trim())
        .toBe(level < 45 ? 'dark_mode' : 'light_mode');
    }
  });

  it('hides app content while signed out and starts sign-in', () => {
    auth.status.set('signedOut');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-sidenav-container')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sport-panel')).toBeNull();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.auth-screen button');
    button.click();
    expect(auth.signIn).toHaveBeenCalledOnce();
  });

  it('moves the sign-in logo to the next sport every 5 seconds', () => {
    vi.useFakeTimers();
    try {
      auth.status.set('signedOut');
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const shown = () => Array.from<HTMLImageElement>(fixture.nativeElement.querySelectorAll('.auth-logo img.shown'))
        .map((logo) => logo.getAttribute('src'));
      expect(shown()).toEqual(['images/logos/logo.svg']);
      vi.advanceTimersByTime(4999);
      fixture.detectChanges();
      expect(shown()).toEqual(['images/logos/logo.svg']);
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(shown()).toEqual(['images/logos/logo-basketball.svg']);
      // After hockey it starts again with baseball.
      vi.advanceTimersByTime(15000);
      fixture.detectChanges();
      expect(shown()).toEqual(['images/logos/logo.svg']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains that authentication must be configured before sign-in', () => {
    auth.status.set('notConfigured');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Authentication setup is required');
    expect(fixture.nativeElement.textContent).toContain('scripts/create-cognito-pool.ps1');
    expect(fixture.nativeElement.querySelector('mat-sidenav-container')).toBeNull();
  });

  it('shows auth errors when signed out', () => {
    auth.status.set('signedOut');
    auth.error.set('Sign-in failed.');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Sign-in failed.');
  });

  it('opens the in-app registration form', async () => {
    auth.status.set('signedOut');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    buttons.find((button) => button.textContent?.includes('Create account'))?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-registration')).not.toBeNull();
  });

  it('opens the profile menu and signs out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-label="Profile"]');
    button.click();
    fixture.detectChanges();
    const menu = document.querySelector('.mat-mdc-menu-panel');
    expect(menu?.textContent).toContain('user@example.com');
    const buttons = Array.from(menu?.querySelectorAll('button') ?? []);
    buttons.find((item) => item.textContent?.includes('Sign out'))?.click();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('shows available names in the profile menu and updates when account details change', () => {
    account.details.set({ email: 'user@example.com', firstName: ' Jane ', lastName: ' Doe ', phoneNumber: null });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Profile"]').click();
    fixture.detectChanges();
    const profileName = document.querySelector('.mat-mdc-menu-panel .profile-name');
    expect(profileName?.textContent?.trim()).toBe('Jane Doe');

    account.details.set({ email: 'user@example.com', firstName: null, lastName: 'Doe', phoneNumber: null });
    fixture.detectChanges();
    expect(profileName?.textContent?.trim()).toBe('Doe');

    account.details.set({ email: 'user@example.com', firstName: 'Jane', lastName: '  ', phoneNumber: null });
    fixture.detectChanges();
    expect(profileName?.textContent?.trim()).toBe('Jane');

    account.details.set({ email: 'user@example.com', firstName: ' ', lastName: null, phoneNumber: null });
    fixture.detectChanges();
    expect(profileName?.textContent?.trim()).toBe('user@example.com');
  });

  it('uses the Cognito first name when account details have no first name', () => {
    auth.firstName.set('Alex');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Profile"]').click();
    fixture.detectChanges();
    expect(document.querySelector('.mat-mdc-menu-panel .profile-name')?.textContent?.trim()).toBe('Alex');
  });

  it('opens account details from the profile menu', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Profile"]').click();
    fixture.detectChanges();
    const buttons = Array.from(document.querySelectorAll('.mat-mdc-menu-panel button'));
    (buttons.find((item) => item.textContent?.includes('Account details')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(account.open).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Account details');
  });

  it('places a more-options menu last in the toolbar with About, the API docs being in the footer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toolbarButtons = fixture.nativeElement.querySelectorAll('.app-content > .app-toolbar > button');
    const more: HTMLButtonElement = toolbarButtons[toolbarButtons.length - 1];
    expect(more.getAttribute('aria-label')).toBe('More options');
    more.click();
    fixture.detectChanges();
    const panel = document.querySelector('.mat-mdc-menu-panel');
    expect(panel?.querySelector('a[mat-menu-item]')).toBeNull();
    const about = Array.from(panel?.querySelectorAll('button') ?? []).find((item) => item.textContent?.includes('About'));
    about?.click();
    fixture.detectChanges();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toContain('About');
  });

  it('shows onboarding when account details are missing', () => {
    account.state.set('missing');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Complete your account details');
    const email = dialog.querySelector('textarea.account-email') as HTMLTextAreaElement;
    expect(email.value).toBe('user@example.com');
    expect(email.readOnly).toBe(true);
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(account.save).not.toHaveBeenCalled();
    expect(TestBed.inject(MatDialog).openDialogs[0].disableClose).toBe(true);
    Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Sign out'))?.click();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('shows a retry action when loading fails', () => {
    account.state.set('error');
    account.error.set('Could not load account details.');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('main button').click();
    expect(account.load).toHaveBeenCalled();
  });

  it('edits account details and submits trimmed values', () => {
    account.editing.set(true);
    account.details.set({ email: 'user@example.com', firstName: 'Old', lastName: 'Name', phoneNumber: null });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const first = dialog.querySelector('input[formControlName="firstName"]') as HTMLInputElement;
    const last = dialog.querySelector('input[formControlName="lastName"]') as HTMLInputElement;
    const phone = dialog.querySelector('input[formControlName="phoneNumber"]') as HTMLInputElement;
    expect(first.value).toBe('Old');
    first.value = ' Jane ';
    last.value = ' Doe ';
    phone.value = ' 123 ';
    for (const input of [first, last, phone]) input.dispatchEvent(new Event('input'));
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(account.save).toHaveBeenCalledWith({ firstName: 'Jane', lastName: 'Doe', phoneNumber: '123' });
    const buttons = Array.from(dialog.querySelectorAll('button'));
    buttons.find((button) => button.textContent?.includes('Cancel'))?.click();
    expect(account.cancel).toHaveBeenCalledOnce();
  });

  it('only enables account Save when normalized form values change', () => {
    account.editing.set(true);
    account.details.set({ email: 'user@example.com', firstName: 'Jane', lastName: 'Doe', phoneNumber: null });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const save = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    const first = dialog.querySelector('input[formControlName="firstName"]') as HTMLInputElement;
    const phone = dialog.querySelector('input[formControlName="phoneNumber"]') as HTMLInputElement;
    expect(save.disabled).toBe(true);
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(account.save).not.toHaveBeenCalled();

    first.value = ' Jane ';
    first.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(true);

    phone.value = '123';
    phone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(false);

    account.saving.set(true);
    fixture.detectChanges();
    expect(save.disabled).toBe(true);
    account.saving.set(false);
    phone.value = '';
    phone.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(true);
  });

  it('enables Save for changed onboarding details', () => {
    account.state.set('missing');
    auth.firstName.set('Jane');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const save = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    const last = dialog.querySelector('input[formControlName="lastName"]') as HTMLInputElement;
    expect(save.disabled).toBe(true);
    last.value = 'Doe';
    last.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(false);
    dialog.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(account.save).toHaveBeenCalledWith({ firstName: 'Jane', lastName: 'Doe', phoneNumber: null });
  });

  it('closes the dialog when onboarding succeeds or the user signs out', () => {
    account.state.set('missing');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = TestBed.inject(MatDialog);
    expect(dialog.openDialogs.length).toBe(1);
    const onboarding = dialog.openDialogs[0];
    account.state.set('ready');
    fixture.detectChanges();
    expect(onboarding.getState()).not.toBe(MatDialogState.OPEN);

    account.editing.set(true);
    fixture.detectChanges();
    auth.status.set('signedOut');
    fixture.detectChanges();
    expect(dialog.openDialogs.every((ref) => ref.getState() !== MatDialogState.OPEN)).toBe(true);
  });

  it('keeps the form open and shows errors from account save or sign-out', () => {
    account.state.set('missing');
    account.error.set('Could not save account details.');
    auth.error.set('Sign-out failed.');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('Could not save account details.');
    expect(dialog.textContent).toContain('Sign-out failed.');
    expect(TestBed.inject(MatDialog).openDialogs[0].getState()).toBe(MatDialogState.OPEN);
  });

  it('synchronizes editing when the dialog is dismissed and blocks dismissal while saving', () => {
    account.editing.set(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const dialog = TestBed.inject(MatDialog);
    const ref = dialog.openDialogs[0];
    expect(ref.disableClose).toBe(false);
    account.saving.set(true);
    fixture.detectChanges();
    expect(ref.disableClose).toBe(true);
    account.saving.set(false);
    fixture.detectChanges();
    ref.close();
    expect(account.cancel).toHaveBeenCalledOnce();
    expect(account.editing()).toBe(false);
  });

  it('greets signed-in users by first name when available', () => {
    auth.firstName.set('Alex');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('main h1').textContent).toContain("Welcome to Combs' Corner Cards, Alex");
  });

  it('keeps the generic greeting for users without a first name', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('main h1').textContent.trim()).toBe("Welcome to Combs' Corner Cards!");
  });
});
