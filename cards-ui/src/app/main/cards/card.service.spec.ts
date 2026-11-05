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
    cardNumber: '141', player: 'Michael Jordan', variety: null, grade: 'EX-MT 6',
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

  it('builds photo URLs on the photos host', () => {
    expect(cardPhotoUrl(card, 'front')).toBe(`${PROJECT_SETTINGS.photosUrl}94481237/front.jpg`);
    expect(cardPhotoUrl({ ...card, photoId: 'order-24358316-r01' }, 'back'))
      .toBe(`${PROJECT_SETTINGS.photosUrl}order-24358316-r01/back.jpg`);
  });
});
