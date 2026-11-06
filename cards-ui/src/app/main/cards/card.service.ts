import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../../api-url';
import { PROJECT_SETTINGS } from '../../project.settings';

export interface Card {
  photoId: string;
  certNumber: string | null;
  sport: string;
  year: number;
  setName: string;
  cardNumber: string;
  player: string;
  variety: string | null;
  grade: string | null;
  ebayUrl: string | null;
}

/** A card's editable details; the photo ID stays fixed because it names the card's photos. */
export type CardUpdate = Omit<Card, 'photoId'>;

type CardState = 'idle' | 'loading' | 'ready' | 'error';

export type CardSide = 'front' | 'back';

/**
 * The photo of one side of a card, served by the UI's CloudFront distribution from the photo bucket:
 * 1000 px tall, or with `zoom` up to 2400 px for the zoom dialog.
 */
export function cardPhotoUrl(card: Card, side: CardSide, zoom = false): string {
  return `${PROJECT_SETTINGS.photosUrl}${encodeURIComponent(card.photoId)}/${side}${zoom ? '-zoom' : ''}.jpg`;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly http = inject(HttpClient);
  private generation = 0;
  readonly state = signal<CardState>('idle');
  readonly cards = signal<Card[]>([]);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');

  async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    this.error.set('');
    try {
      const headers = await this.authHeaders();
      if (generation !== this.generation) return;
      const cards = await firstValueFrom(this.http.get<Card[]>(apiUrl('/api/cards'), { headers }));
      if (generation !== this.generation) return;
      this.cards.set(cards);
      this.state.set('ready');
    } catch (error) {
      if (generation !== this.generation) return;
      console.error('Could not load the cards', error);
      this.error.set(error instanceof HttpErrorResponse && error.status === 401
        ? 'Your session is invalid or your email is not verified. Sign out and sign in again.'
        : 'Could not load the cards. Please try again.');
      this.state.set('error');
    }
  }

  /** Saves an admin's edit and shows it in place; resolves to whether it was saved. */
  async save(photoId: string, update: CardUpdate): Promise<boolean> {
    if (this.saving()) return false;
    const generation = this.generation;
    this.saving.set(true);
    this.saveError.set('');
    try {
      const headers = await this.authHeaders();
      if (generation !== this.generation) return false;
      const url = apiUrl(`/api/cards/${encodeURIComponent(photoId)}`);
      const saved = await firstValueFrom(this.http.put<Card>(url, update, { headers }));
      if (generation !== this.generation) return false;
      this.cards.update((cards) => cards.map((card) => (card.photoId === photoId ? saved : card)));
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      console.error('Could not save the card', error);
      this.saveError.set(this.saveErrorMessage(error));
      return false;
    } finally {
      if (generation === this.generation) this.saving.set(false);
    }
  }

  clearSaveError(): void {
    this.saveError.set('');
  }

  reset(): void {
    this.generation++;
    this.cards.set([]);
    this.error.set('');
    this.saving.set(false);
    this.saveError.set('');
    this.state.set('idle');
  }

  private saveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'Your session is invalid or your email is not verified. Sign out and sign in again.';
      if (error.status === 403) return 'Only admins can edit cards.';
      if (error.status === 404) return 'This card no longer exists. Reload the page.';
      if (error.status === 409) return 'Another card already has this cert number.';
    }
    return 'Could not save the card. Please try again.';
  }

  private async authHeaders(): Promise<HttpHeaders> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken;
    if (!token) throw new Error('No Cognito identity token is available.');
    return new HttpHeaders({ Authorization: `Bearer ${token.toString()}` });
  }
}
