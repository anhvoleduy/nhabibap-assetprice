import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GoldService, PricePoint } from './gold.service';

describe('GoldService', () => {
  let service: GoldService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoldService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPriceHistory', () => {
    it('maps XAU response to PricePoint array', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      reqs[0].flush({ date: '2025-01-01', xau: { usd: 2700 } });
      reqs[1].flush({ date: '2025-01-02', xau: { usd: 2750 } });

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ date: '2025-01-01', close: 2700 });
    });

    it('filters out zero-price results', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      reqs.forEach(req => req.flush({ date: '2025-01-01', xau: { usd: 0 } }));

      expect(result.length).toBe(0);
    });

    it('handles HTTP errors gracefully', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      reqs.forEach(req => req.flush('error', { status: 500, statusText: 'Server Error' }));

      expect(result.length).toBe(0);
    });

    it('sorts results by date ascending', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory(1).subscribe(r => (result = r));

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      reqs[0].flush({ date: '2025-01-02', xau: { usd: 2750 } });
      reqs[1].flush({ date: '2025-01-01', xau: { usd: 2700 } });

      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
    });
  });

  describe('getDcaPrices', () => {
    it('returns empty observable when start date is in future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      let result: PricePoint[] = [];
      service.getDcaPrices(future.toISOString().split('T')[0], 'monthly').subscribe(r => (result = r));

      httpMock.expectNone(req => req.url.includes('/v1/currencies/xau.min.json'));
      expect(result).toEqual([]);
    });

    it('builds weekly dates (7-day intervals)', () => {
      const start = new Date();
      start.setDate(start.getDate() - 14);

      service.getDcaPrices(start.toISOString().split('T')[0], 'weekly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      expect(reqs.length).toBe(3);
      reqs.forEach((req, i) => req.flush({ date: `2025-01-0${i + 1}`, xau: { usd: 2700 } }));
    });

    it('builds monthly dates (1-month intervals)', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 2);

      service.getDcaPrices(start.toISOString().split('T')[0], 'monthly').subscribe();

      const reqs = httpMock.match(req => req.url.includes('/v1/currencies/xau.min.json'));
      expect(reqs.length).toBe(3);
      reqs.forEach((req, i) => req.flush({ date: `2025-0${i + 1}-01`, xau: { usd: 2700 } }));
    });
  });
});
