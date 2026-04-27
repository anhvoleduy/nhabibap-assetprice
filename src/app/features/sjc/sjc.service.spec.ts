import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SjcService, SjcPricePoint } from './sjc.service';

const MOCK_HISTORY_RESPONSE = {
  success: true,
  days: 30,
  type: 'SJL1L10',
  history: [
    {
      date: '2026-04-25',
      prices: { SJL1L10: { buy: 166_300_000, sell: 168_800_000 } },
    },
    {
      date: '2026-04-24',
      prices: { SJL1L10: { buy: 165_500_000, sell: 168_000_000 } },
    },
  ],
};

describe('SjcService', () => {
  let service: SjcService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SjcService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPriceHistory', () => {
    it('maps vang.today history to SjcPricePoint array', () => {
      let result: SjcPricePoint[] = [];
      service.getPriceHistory().subscribe(r => (result = r));

      const req = httpMock.expectOne(r => r.url.includes('/api/vang-today/api/prices'));
      req.flush(MOCK_HISTORY_RESPONSE);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ date: '2026-04-24', buy: 165_500_000, sell: 168_000_000 });
      expect(result[1]).toEqual({ date: '2026-04-25', buy: 166_300_000, sell: 168_800_000 });
    });

    it('sorts results by date ascending', () => {
      let result: SjcPricePoint[] = [];
      service.getPriceHistory().subscribe(r => (result = r));

      const req = httpMock.expectOne(r => r.url.includes('/api/vang-today/api/prices'));
      req.flush(MOCK_HISTORY_RESPONSE);

      expect(result[0].date < result[1].date).toBe(true);
    });

    it('filters out zero-price entries', () => {
      let result: SjcPricePoint[] = [];
      service.getPriceHistory().subscribe(r => (result = r));

      const req = httpMock.expectOne(r => r.url.includes('/api/vang-today/api/prices'));
      req.flush({
        success: true,
        history: [
          { date: '2026-04-25', prices: { SJL1L10: { buy: 0, sell: 0 } } },
        ],
      });

      expect(result.length).toBe(0);
    });

    it('returns empty array on HTTP error', () => {
      let result: SjcPricePoint[] = [];
      service.getPriceHistory().subscribe(r => (result = r));

      const req = httpMock.expectOne(r => r.url.includes('/api/vang-today/api/prices'));
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(result).toEqual([]);
    });
  });

  describe('getDcaPrices', () => {
    const flushVndRate = (rate = 25_500) => {
      const req = httpMock.expectOne(r => r.url.includes('/v1/currencies/usd.min.json'));
      req.flush({ date: '2026-04-25', usd: { vnd: rate } });
    };

    it('returns empty when start date is in future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      let result: SjcPricePoint[] = [];
      service.getDcaPrices(future.toISOString().split('T')[0], 'monthly').subscribe(r => (result = r));

      httpMock.expectNone(r => r.url.includes('/v1/currencies/'));
      expect(result).toEqual([]);
    });

    it('returns SjcPricePoint array with buy > sell', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);

      let result: SjcPricePoint[] = [];
      service.getDcaPrices(start.toISOString().split('T')[0], 'monthly').subscribe(r => (result = r));

      flushVndRate();

      const reqs = httpMock.match(r => r.url.includes('/v1/currencies/xau.min.json'));
      reqs.forEach(req => req.flush({ date: '2026-04-01', xau: { usd: 3300 } }));

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].buy).toBeGreaterThan(result[0].sell);
    });

    it('returns empty when VND rate fetch fails', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);

      let result: SjcPricePoint[] = [];
      service.getDcaPrices(start.toISOString().split('T')[0], 'monthly').subscribe(r => (result = r));

      const req = httpMock.expectOne(r => r.url.includes('/v1/currencies/usd.min.json'));
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(result).toEqual([]);
    });
  });
});
