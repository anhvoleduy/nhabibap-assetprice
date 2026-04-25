import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EtfService, PricePoint, VnEtf } from './etf.service';

const toEpoch = (dateStr: string) => Math.floor(new Date(dateStr).getTime() / 1000);

describe('EtfService', () => {
  let service: EtfService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EtfService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getEtfList', () => {
    it('returns the hardcoded VN ETF list synchronously', () => {
      let list: VnEtf[] = [];
      service.getEtfList().subscribe(r => (list = r));
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].code).toBe('E1VFVN30');
    });

    it('contains required fields on each ETF', () => {
      service.getEtfList().subscribe(list => {
        list.forEach(etf => {
          expect(etf.code).toBeTruthy();
          expect(etf.label).toBeTruthy();
          expect(etf.index).toBeTruthy();
        });
      });
    });
  });

  describe('getPriceHistory', () => {
    it('calls HSX API with correct ticker and date params', () => {
      service.getPriceHistory('E1VFVN30', 30).subscribe();

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      expect(req.request.params.has('fromDate')).toBe(true);
      expect(req.request.params.has('toDate')).toBe(true);
      req.flush({ success: true, message: null, data: [] });
    });

    it('maps HSX bar data to PricePoint array', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('E1VFVN30', 30).subscribe(r => (result = r));

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      req.flush({
        success: true,
        message: null,
        data: [
          { reportdate: toEpoch('2025-01-01'), closeprice: 15000, totalshare: 100 },
          { reportdate: toEpoch('2025-01-02'), closeprice: 15500, totalshare: 200 },
        ],
      });

      expect(result.length).toBe(2);
      expect(result[0].close).toBe(15000);
      expect(result[0].date).toBe('2025-01-01');
    });

    it('filters out bars with zero close price', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('E1VFVN30', 30).subscribe(r => (result = r));

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      req.flush({
        success: true,
        message: null,
        data: [{ reportdate: toEpoch('2025-01-01'), closeprice: 0, totalshare: 0 }],
      });

      expect(result.length).toBe(0);
    });

    it('returns empty array on HTTP error', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('E1VFVN30', 30).subscribe(r => (result = r));

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(result).toEqual([]);
    });

    it('sorts results by date ascending', () => {
      let result: PricePoint[] = [];
      service.getPriceHistory('E1VFVN30', 30).subscribe(r => (result = r));

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      req.flush({
        success: true,
        message: null,
        data: [
          { reportdate: toEpoch('2025-01-03'), closeprice: 16000, totalshare: 100 },
          { reportdate: toEpoch('2025-01-01'), closeprice: 15000, totalshare: 100 },
          { reportdate: toEpoch('2025-01-02'), closeprice: 15500, totalshare: 100 },
        ],
      });

      expect(result[0].date).toBe('2025-01-01');
      expect(result[1].date).toBe('2025-01-02');
      expect(result[2].date).toBe('2025-01-03');
    });
  });

  describe('getDcaPrices', () => {
    it('returns empty observable when start date is in future', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      let result: PricePoint[] = [];
      service
        .getDcaPrices('E1VFVN30', future.toISOString().split('T')[0], 'monthly')
        .subscribe(r => (result = r));

      httpMock.expectNone(r => r.url.includes('/api/hsx'));
      expect(result).toEqual([]);
    });

    it('filters all prices to DCA schedule dates', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      const startDate = start.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      let result: PricePoint[] = [];
      service.getDcaPrices('E1VFVN30', startDate, 'monthly').subscribe(r => (result = r));

      const req = httpMock.expectOne(r =>
        r.url.includes('/api/hsx/mk/api/v1/market/securities/chart/E1VFVN30'),
      );
      req.flush({
        success: true,
        message: null,
        data: [
          { reportdate: toEpoch(startDate), closeprice: 15000, totalshare: 100 },
          { reportdate: toEpoch(today), closeprice: 16000, totalshare: 100 },
        ],
      });

      expect(result.length).toBe(2);
    });
  });
});
