import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, timer } from 'rxjs';
import { ThemeService } from '../theme/theme.service';
import { AuthService } from '../auth/auth.service';
import { RegistrationComponent } from '../auth/registration';
import { AccountService } from './account/account.service';
import { AccountDetailsComponent } from './account/account-details';
import { ApiStatusService } from './api-status/api-status.service';
import { Card, CardService, cardPhotoUrl, psaCertUrl } from './cards/card.service';
import { CardEditComponent } from './cards/card-edit';
import { CardZoomComponent, CardZoomData } from './cards/card-zoom';
import { FullTextTooltipDirective } from './cards/full-text-tooltip';
import { PanelStateService } from './cards/panel-state.service';
import { apiUrl } from '../api-url';
import { APP_DISPLAY_NAME, DEVELOPER_NAME } from './app-name';
import { AboutDialogComponent } from './about/about-dialog';
import { ToolbarBackgroundComponent } from '../theme/toolbar-background';

/** A dashboard tab and side-menu entry, with its Material `icon`. */
interface Sport {
  label: string;
  icon: string;
  /** The toolbar logo while the sport's tab is selected, in public/images/logos/. */
  logo: string;
}

/** Cards shown together in a sport's tab, in a panel that starts open, by grade. */
interface CardGroup {
  title: string;
  count: number;
  grades: GradeGroup[];
  /** Whether its grade panels start open, until the viewer opens or closes them. */
  gradesOpen: boolean;
}

/** A group's cards of one PSA grade, in a panel of their own within it. */
interface GradeGroup {
  title: string;
  cards: Card[];
}

/** Splits cards by grade, highest PSA number first; cards without a grade come last. */
function byGrade(cards: Card[]): GradeGroup[] {
  const grades = new Map<string, Card[]>();
  for (const card of cards) {
    const title = card.grade ? `PSA ${card.grade}` : 'Ungraded';
    grades.set(title, [...(grades.get(title) ?? []), card]);
  }
  const number = (title: string) => Number(/(\d+(?:\.\d+)?)$/.exec(title)?.[1] ?? -1);
  return Array.from(grades, ([title, cards]) => ({ title, cards })).sort((a, b) => number(b.title) - number(a.title));
}

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatExpansionModule, MatIconModule, MatListModule, MatMenuModule, MatSidenavModule, MatTabsModule, MatToolbarModule, MatTooltipModule, FullTextTooltipDirective, RegistrationComponent, ToolbarBackgroundComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './brightness-control.scss', './toolbar.scss', './sport-cards.scss', './panels.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly appName = APP_DISPLAY_NAME;
  protected readonly developerName = DEVELOPER_NAME;
  protected readonly apiDocsUrl = apiUrl('/swagger-ui.html');
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly account = inject(AccountService);
  protected readonly apiStatus = inject(ApiStatusService).status;
  protected readonly apiStatusLabel = computed(() => {
    switch (this.apiStatus()) {
      case 'up':
        return 'API is up';
      case 'down':
        return 'API is unreachable';
      default:
        return 'Checking API status';
    }
  });
  protected readonly profileName = computed(() => {
    const details = this.account.details();
    const firstName = details?.firstName?.trim() || this.auth.firstName().trim();
    const lastName = details?.lastName?.trim();
    return [firstName, lastName].filter(Boolean).join(' ') || this.auth.email() || details?.email || '';
  });
  protected readonly registrationOpen = signal(false);
  protected readonly brightnessOpen = signal(false);
  protected readonly sports: Sport[] = [
    { label: 'Baseball', icon: 'sports_baseball', logo: 'images/logos/logo.svg' },
    { label: 'Basketball', icon: 'sports_basketball', logo: 'images/logos/logo-basketball.svg' },
    { label: 'Football', icon: 'sports_football', logo: 'images/logos/logo-football.svg' },
    { label: 'Hockey', icon: 'sports_hockey', logo: 'images/logos/logo-hockey.svg' },
  ];
  protected readonly selectedSport = signal(0);
  /** The sport whose logo the sign-in screen shows, moving to the next every 5 seconds. */
  protected readonly signInSport = toSignal(timer(5000, 5000).pipe(map((tick) => (tick + 1) % this.sports.length)), { initialValue: 0 });
  protected readonly cards = inject(CardService);
  /**
   * Each sport's cards in groups, both shown open: those listed on eBay, then the rest, which have
   * sold; within each, by grade, and in the API's order within a grade. The listed cards' grades start
   * open and the sold cards' closed. Empty groups are left out.
   */
  protected readonly cardsBySport = computed(() => {
    const bySport = new Map<string, Card[]>(this.sports.map((sport) => [sport.label, []]));
    for (const card of this.cards.cards()) bySport.get(card.sport)?.push(card);
    const group = (title: string, cards: Card[], gradesOpen: boolean): CardGroup =>
      ({ title, count: cards.length, grades: byGrade(cards), gradesOpen });
    return new Map(Array.from(bySport, ([sport, cards]): [string, CardGroup[]] => [sport, [
      group('Current eBay Listings', cards.filter((card) => card.ebayUrl), true),
      group('Sold', cards.filter((card) => !card.ebayUrl), false),
    ].filter((g) => g.count)]));
  });
  /** Which card panels are open, remembered in this browser. */
  protected readonly panels = inject(PanelStateService);
  /** Photo IDs of the cards turned over to show their backs. */
  protected readonly flipped = signal<ReadonlySet<string>>(new Set());
  protected readonly cardPhotoUrl = cardPhotoUrl;
  protected readonly psaCertUrl = psaCertUrl;
  private readonly dialog = inject(MatDialog);
  private accountDialog: MatDialogRef<AccountDetailsComponent> | null = null;

  constructor() {
    effect(() => {
      const status = this.auth.status();
      untracked(() => {
        if (status === 'signedIn') {
          void this.account.load();
          void this.cards.load();
        } else {
          this.account.reset();
          this.cards.reset();
          this.flipped.set(new Set());
        }
      });
    });

    effect(() => {
      const signedIn = this.auth.status() === 'signedIn';
      const state = this.account.state();
      const editing = this.account.editing();
      const saving = this.account.saving();
      untracked(() => {
        const shouldOpen = signedIn && (state === 'missing' || (state === 'ready' && editing));
        if (!shouldOpen) {
          const current = this.accountDialog;
          this.accountDialog = null;
          current?.close();
          return;
        }
        if (this.accountDialog) {
          this.accountDialog.disableClose = state === 'missing' || saving;
          return;
        }
        const ref = this.dialog.open(AccountDetailsComponent, {
          width: '480px',
          maxWidth: 'calc(100vw - 32px)',
          disableClose: state === 'missing' || saving,
        });
        this.accountDialog = ref;
        ref.beforeClosed().subscribe(() => {
          if (this.accountDialog === ref) {
            this.accountDialog = null;
            if (this.account.editing()) this.account.cancel();
          }
        });
      });
    });
  }

  /** Side mode on wide screens; dismissible overlay on narrow screens. */
  protected readonly isWide = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((state) => state.matches)),
    { initialValue: true },
  );

  protected readonly sidenavOpened = signal(false);

  protected toggleSidenav(): void {
    this.sidenavOpened.update((opened) => !opened);
  }

  protected showSport(index: number): void {
    this.selectedSport.set(index);
    if (!this.isWide()) this.sidenavOpened.set(false);
  }

  protected toggleFlip(card: Card): void {
    this.flipped.update((flipped) => {
      const next = new Set(flipped);
      if (!next.delete(card.photoId)) next.add(card.photoId);
      return next;
    });
  }

  /** A grade as the PSA label prints it: its name over its number, e.g. "NM-MT" over "8". */
  protected gradeParts(grade: string): { name: string; number: string | null } {
    const match = /^(.*?)\s*(\d+(?:\.\d+)?)$/.exec(grade);
    // Grades are stored in PSA's capitals; the label shows them in proper case, so "NM-MT" reads "Nm-Mt".
    const name = (match ? match[1] : grade).toLocaleLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase());
    return { name, number: match ? match[2] : null };
  }

  protected cardTitle(card: Card): string {
    return `${card.year} ${card.setName} #${card.cardNumber}`;
  }

  protected zoomCard(card: Card): void {
    const data: CardZoomData = { card, side: this.flipped().has(card.photoId) ? 'back' : 'front' };
    this.dialog.open(CardZoomComponent, { data, width: '720px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected editCard(card: Card): void {
    this.dialog.open(CardEditComponent, { data: card, width: '520px', maxWidth: 'calc(100vw - 32px)' });
  }

  protected openAbout(): void {
    this.dialog.open(AboutDialogComponent, { width: '420px', maxWidth: 'calc(100vw - 32px)' });
  }

}
