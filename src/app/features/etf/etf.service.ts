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

interface HsxEtfItem {
  code: string;
  name: string;
  refIndex: string | null;
}

interface HsxEtfListResponse {
  data: { list: HsxEtfItem[]; total: number };
}

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
    return this.http
      .get<HsxEtfListResponse>('/api/hsx/l/api/v1/1/securities/etf', {
        params: { pageIndex: '1', pageSize: '100', alphabet: '' },
      })
      .pipe(
        map(r =>
          (r.data?.list ?? []).map(item => ({
            code: item.code,
            label: item.name.replace(/^Quỹ ETF\s*/i, '').trim(),
            index: (item.refIndex ?? '').replace(/\s*Index$/i, '').trim(),
          })),
        ),
        catchError(() => of([])),
      );
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
