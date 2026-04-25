import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FiatService, PricePoint } from './fiat.service';

describe('FiatService', () => {
  let service: FiatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FiatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPriceHistory', () => {
    it('maps currency response to PricePoint array', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('eur', 1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      reqs[0].flush({ date: '2025-01-01', eur: { usd: 1.09 } });
      reqs[1].flush({ date: '2025-01-02', eur: { usd: 1.10 } });

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ date: '2025-01-01', close: 1.09 });
    });

    it('uses currency code as key to extract USD rate', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('jpy', 1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/jpy.min.json'));
      reqs[0].flush({ date: '2025-01-01', jpy: { usd: 0.0065 } });
      reqs[1].flush({ date: '2025-01-02', jpy: { usd: 0.0066 } });

      expect(result[0].close).toBeCloseTo(0.0065, 4);
    });

    it('filters out zero-rate results', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('eur', 1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      reqs.forEach(req => req.flush({ date: '2025-01-01', eur: { usd: 0 } }));

      expect(result.length).toBe(0);
    });

    it('handles HTTP errors gracefully', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('eur', 1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      reqs.forEach(req => req.flush('error', { status: 500, statusText: 'Server Error' }));

      expect(result.length).toBe(0);
    });

    it('sorts results by date ascending', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('eur', 1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      reqs[0].flush({ date: '2025-01-02', eur: { usd: 1.10 } });
      reqs[1].flush({ date: '2025-01-01', eur: { usd: 1.09 } });

      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
    });
  });

  describe('getDcaPrices', () => {
    it('returns empty observable when start date is in future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      let result: PricePoint[] = [];
      service.getDcaPrices('eur', future.toISOString().split('T')[0], 'monthly').subscribe(r => (result = r));

      httpMock.expectNone(req => req.url.includes('/v1/currencies/eur.min.json'));
      expect(result).toEqual([]);
    });

    it('builds weekly dates correctly', () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);

      service.getDcaPrices('eur', start.toISOString().split('T')[0], 'weekly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      expect(reqs.length).toBe(3);
      reqs.forEach((req, i) => req.flush({ date: `2025-01-0${i + 1}`, eur: { usd: 1.09 } }));
    });

    it('builds monthly dates correctly', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 2);

      service.getDcaPrices('eur', start.toISOString().split('T')[0], 'monthly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/eur.min.json'));
      expect(reqs.length).toBe(3);
      reqs.forEach((req, i) => req.flush({ date: `2025-0${i + 1}-01`, eur: { usd: 1.09 } }));
    });
  });
});
