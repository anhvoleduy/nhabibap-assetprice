import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface PricePoint {
  date: string;
  close: number;
}

export interface DcaEntry {
  date: string;
  price: number;
  unitsBought: number;
  cumUnits: number;
  cumInvested: number;
  portfolioValue: number;
}

export interface DcaResult {
  entries: DcaEntry[];
  totalInvested: number;
  totalUnits: number;
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
}

export interface VnEtf {
  code: string;
  label: string;
  index: string;
}

const VN_ETF_LIST: VnEtf[] = [
  { code: 'E1VFVN30', label: 'DCVFMVN30', index: 'VN30' },
  { code: 'FUEABVND', label: 'ABFVN DIAMOND', index: 'VN DIAMOND' },
  { code: 'FUEBFVND', label: 'BVFVN DIAMOND', index: 'VNDIAMOND' },
  { code: 'FUEDCMID', label: 'DCVFMVNMIDCAP', index: 'VNMIDCAP' },
  { code: 'FUEFCV50', label: 'FPT CAPITAL VNX50', index: 'VNX50' },
  { code: 'FUEIP100', label: 'IPAAM VN100', index: 'VN100' },
  { code: 'FUEKIV30', label: 'KIM Growth VN30', index: 'VN30' },
  { code: 'FUEKIVFS', label: 'KIM Growth VNFINSELECT', index: 'VNFINSELECT' },
  { code: 'FUEKIVND', label: 'KIM GROWTH VN DIAMOND', index: 'VN DIAMOND' },
  { code: 'FUEMAV30', label: 'MAFM VN30', index: 'VN30' },
  { code: 'FUEMAVND', label: 'MAFM VNDIAMOND', index: 'VNDIAMOND' },
  { code: 'FUESSV30', label: 'SSIAM VN30', index: 'VN30' },
  { code: 'FUESSV50', label: 'SSIAM VNX50', index: 'VNX50' },
  { code: 'FUESSVFL', label: 'SSIAM VNFIN LEAD', index: 'VNFIN LEAD' },
  { code: 'FUETCC50', label: 'TECHCOM CAPITAL VNX50', index: 'VNX50' },
  { code: 'FUETPVND', label: 'VFCVN DIAMOND', index: 'VND' },
  { code: 'FUEVFVND', label: 'DCVFMVN DIAMOND', index: 'VN DIAMOND' },
  { code: 'FUEVN100', label: 'VINACAPITAL VN100', index: 'VN100' },
];

interface HsxBar {
  reportdate: number;
  closeprice: number;
  totalshare: number;
}

interface HsxChartResponse {
  data: HsxBar[];
  success: boolean;
  message: string | null;
}

@Injectable({ providedIn: 'root' })
export class EtfService {
  private http = inject(HttpClient);

  getEtfList(): Observable<VnEtf[]> {
    return of(VN_ETF_LIST);
  }

  getPriceHistory(ticker: string, days: number): Observable<PricePoint[]> {
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    return this.fetchRange(ticker, fromDate, toDate);
  }

  getDcaPrices(ticker: string, startDate: string, frequency: 'weekly' | 'monthly'): Observable<PricePoint[]> {
    const toDate = new Date().toISOString().split('T')[0];
    const dcaDates = this.buildDcaDates(startDate, frequency);
    if (!dcaDates.length) return of([]);

    return this.fetchRange(ticker, startDate, toDate).pipe(
      map(allPrices =>
        dcaDates
          .map(date => allPrices.find(p => p.date >= date) ?? null)
          .filter((p): p is PricePoint => p !== null),
      ),
    );
  }

  private fetchRange(ticker: string, fromDate: string, toDate: string): Observable<PricePoint[]> {
    return this.http
      .get<HsxChartResponse>(`/api/hsx/mk/api/v1/market/securities/chart/${ticker}`, {
        params: { fromDate, toDate },
      })
      .pipe(
        map(r =>
          (r.data ?? [])
            .filter(b => b.closeprice > 0)
            .map(b => ({
              date: new Date(b.reportdate * 1000).toISOString().split('T')[0],
              close: b.closeprice,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        ),
        catchError(() => of([])),
      );
  }

  private buildDcaDates(startDate: string, frequency: 'weekly' | 'monthly'): string[] {
    const dates: string[] = [];
    const current = new Date(startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (current <= today) {
      dates.push(current.toISOString().split('T')[0]);
      if (frequency === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }
    return dates;
  }
}
