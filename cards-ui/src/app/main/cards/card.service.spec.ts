import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchAuthSession: vi.fn() }));
vi.mock('aws-amplify/auth', () => ({ fetchAuthSession: mocks.fetchAuthSession }));

import { Card, CardService, cardPhotoUrl } from './card.service';
import { PROJECT_SETTINGS } from '../../project.settings';

describe('CardService', () => {
  let service: CardService;
  let http: HttpTestingController;
  const card: Card = {
    photoId: '94481237', certNumber: '94481237', sport: 'Basketball', year: 1992, setName: 'Topps Gold',
    cardNumber: '141', player: 'Michael Jordan', variety: null, grade: 'EX-MT 6', ebayUrl: null,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchAuthSession.mockResolvedValue({ tokens: { idToken: 'id-token' } });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('loads the cards with an identity token', async () => {
    const loading = service.load();
    expect(service.state()).toBe('loading');
    const get = await vi.waitFor(() => http.expectOne('/api/cards'));
    expect(get.request.headers.get('Authorization')).toBe('Bearer id-token');
    get.flush([card]);
    await loading;
    expect(service.state()).toBe('ready');
    expect(service.cards()).toEqual([card]);
    service.reset();
    expect(service.state()).toBe('idle');
    expect(service.cards()).toEqual([]);
  });

  it('reports a failed load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loading = service.load();
    (await vi.waitFor(() => http.expectOne('/api/cards'))).flush(null, { status: 500, statusText: 'Server Error' });
    await loading;
    expect(service.state()).toBe('error');
    expect(service.error()).toBe('Could not load the cards. Please try again.');
  });

  it('saves an edit and shows it in place', async () => {
    service.cards.set([card, { ...card, photoId: 'other' }]);
    const { photoId, ...update } = { ...card, player: 'M. Jordan' };
    const saving = service.save(photoId, update);
    expect(service.saving()).toBe(true);
    const put = await vi.waitFor(() => http.expectOne('/api/cards/94481237'));
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Authorization')).toBe('Bearer id-token');
    expect(put.request.body).toEqual(update);
    put.flush({ ...card, player: 'M. Jordan' });
    expect(await saving).toBe(true);
    expect(service.saving()).toBe(false);
    expect(service.cards().map((c) => c.player)).toEqual(['M. Jordan', 'Michael Jordan']);
  });

  it('explains a rejected edit and keeps the card as it was', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.cards.set([card]);
    const { photoId, ...update } = card;
    for (const [status, message] of [
      [403, 'Only admins can edit cards.'],
      [409, 'Another card already has this cert number.'],
      [500, 'Could not save the card. Please try again.'],
    ] as const) {
      const saving = service.save(photoId, update);
      (await vi.waitFor(() => http.expectOne('/api/cards/94481237'))).flush(null, { status, statusText: 'Error' });
      expect(await saving).toBe(false);
      expect(service.saveError()).toBe(message);
    }
    expect(service.cards()).toEqual([card]);
    expect(service.saving()).toBe(false);
  });

  it('builds photo URLs on the photos host', () => {
    expect(cardPhotoUrl(card, 'front')).toBe(`${PROJECT_SETTINGS.photosUrl}94481237/front.jpg`);
    expect(cardPhotoUrl({ ...card, photoId: 'order-24358316-r01' }, 'back'))
      .toBe(`${PROJECT_SETTINGS.photosUrl}order-24358316-r01/back.jpg`);
    expect(cardPhotoUrl(card, 'back', true)).toBe(`${PROJECT_SETTINGS.photosUrl}94481237/back-zoom.jpg`);
  });
});
