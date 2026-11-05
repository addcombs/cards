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
}

type CardState = 'idle' | 'loading' | 'ready' | 'error';

/** The photo of one side of a card, served by the UI's CloudFront distribution from the photo bucket. */
export function cardPhotoUrl(card: Card, side: 'front' | 'back'): string {
  return `${PROJECT_SETTINGS.photosUrl}${encodeURIComponent(card.photoId)}/${side}.jpg`;
}

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly http = inject(HttpClient);
  private generation = 0;
  readonly state = signal<CardState>('idle');
  readonly cards = signal<Card[]>([]);
  readonly error = signal('');

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

  reset(): void {
    this.generation++;
    this.cards.set([]);
    this.error.set('');
    this.state.set('idle');
  }

  private async authHeaders(): Promise<HttpHeaders> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken;
    if (!token) throw new Error('No Cognito identity token is available.');
    return new HttpHeaders({ Authorization: `Bearer ${token.toString()}` });
  }
}
