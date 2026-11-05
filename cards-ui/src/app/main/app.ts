import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map } from 'rxjs';
import { ThemeService } from '../theme/theme.service';
import { AuthService } from '../auth/auth.service';
import { RegistrationComponent } from '../auth/registration';
import { AccountService } from './account/account.service';
import { AccountDetailsComponent } from './account/account-details';
import { ApiStatusService } from './api-status/api-status.service';
import { apiUrl } from '../api-url';
import { APP_DISPLAY_NAME, DEVELOPER_NAME } from './app-name';
import { AboutDialogComponent } from './about/about-dialog';
import { ToolbarBackgroundComponent } from '../theme/toolbar-background';

/** A dashboard tab and side-menu entry, with its Material `icon`. */
export interface Sport {
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, MatListModule, MatMenuModule, MatSidenavModule, MatTabsModule, MatToolbarModule, MatTooltipModule, RegistrationComponent, ToolbarBackgroundComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './brightness-control.scss'],
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
    { label: 'Baseball', icon: 'sports_baseball' },
    { label: 'Basketball', icon: 'sports_basketball' },
    { label: 'Football', icon: 'sports_football' },
    { label: 'Hockey', icon: 'sports_hockey' },
  ];
  protected readonly selectedSport = signal(0);
  private readonly dialog = inject(MatDialog);
  private accountDialog: MatDialogRef<AccountDetailsComponent> | null = null;

  constructor() {
    effect(() => {
      const status = this.auth.status();
      untracked(() => {
        if (status === 'signedIn') {
          void this.account.load();
        } else {
          this.account.reset();
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

  protected openAbout(): void {
    this.dialog.open(AboutDialogComponent, { width: '420px', maxWidth: 'calc(100vw - 32px)' });
  }

}
