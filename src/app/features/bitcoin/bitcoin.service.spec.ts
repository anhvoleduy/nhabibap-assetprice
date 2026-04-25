import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BitcoinService, PricePoint } from './bitcoin.service';

const BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

describe('BitcoinService', () => {
  let service: BitcoinService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BitcoinService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPriceHistory', () => {
    it('maps response to PricePoint array', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      reqs[0].flush({ date: '2025-01-01', btc: { usd: 50000 } });
      reqs[1].flush({ date: '2025-01-02', btc: { usd: 52000 } });

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ date: '2025-01-01', close: 50000 });
      expect(result[1]).toEqual({ date: '2025-01-02', close: 52000 });
    });

    it('filters out zero-price results', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      reqs.forEach(req => req.flush({ date: '2025-01-01', btc: { usd: 0 } }));

      expect(result.length).toBe(0);
    });

    it('handles HTTP errors by filtering out failed requests', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      reqs.forEach(req => req.flush('error', { status: 500, statusText: 'Server Error' }));

      expect(result.length).toBe(0);
    });

    it('sorts results by date ascending', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      reqs[0].flush({ date: '2025-01-02', btc: { usd: 52000 } });
      reqs[1].flush({ date: '2025-01-01', btc: { usd: 50000 } });

      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
    });

    it('uses step=1 for days <= 90', () => {
      service.getPriceHistory(7).subscribe();
      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      expect(reqs.length).toBe(8); // i from 7 to 0 inclusive
      reqs.forEach(r => r.flush({ date: '2025-01-01', btc: { usd: 50000 } }));
    });

    it('uses step=5 for days > 90 and <= 365', () => {
      service.getPriceHistory(180).subscribe();
      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      // i from 180 to 0 step 5: Math.floor(180/5) + 1 = 37 dates
      expect(reqs.length).toBe(37);
      reqs.forEach(r => r.flush({ date: '2025-01-01', btc: { usd: 50000 } }));
    });
  });

  describe('getDcaPrices', () => {
    it('returns empty observable when start date is in future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const startDate = future.toISOString().split('T')[0];

      let result: PricePoint[] = [];
      service.getDcaPrices(startDate, 'monthly').subscribe(r => (result = r));

      httpMock.expectNone(req => req.url.includes('/v1/currencies/btc.min.json'));
      expect(result).toEqual([]);
    });

    it('builds weekly dates (7-day intervals)', () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);
      const startDate = start.toISOString().split('T')[0];

      service.getDcaPrices(startDate, 'weekly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      expect(reqs.length).toBe(3); // -14d, -7d, today
      reqs.forEach((req, i) =>
        req.flush({ date: `2025-01-0${i + 1}`, btc: { usd: 50000 } }),
      );
    });

    it('builds monthly dates (1-month intervals)', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 2);
      const startDate = start.toISOString().split('T')[0];

      service.getDcaPrices(startDate, 'monthly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      expect(reqs.length).toBe(3); // -2mo, -1mo, this month
      reqs.forEach((req, i) =>
        req.flush({ date: `2025-0${i + 1}-01`, btc: { usd: 50000 } }),
      );
    });

    it('filters out failed requests in DCA fetch', () => {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const startDate = start.toISOString().split('T')[0];

      let result: PricePoint[] = [];
      service.getDcaPrices(startDate, 'weekly').subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/btc.min.json'));
      reqs[0].flush('error', { status: 500, statusText: 'Server Error' });
      reqs[1].flush({ date: '2025-01-02', btc: { usd: 52000 } });

      expect(result.length).toBe(1);
      expect(result[0].close).toBe(52000);
    });
  });
});
