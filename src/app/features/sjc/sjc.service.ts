import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface SjcPricePoint {
  date: string;
  buy: number;  // VND/lượng – Giá Mua Vào (SJC buys from you; lower price)
  sell: number; // VND/lượng – Giá Bán Ra (SJC sells to you; higher price)
}

export interface SjcDcaEntry {
  date: string;
  buyPrice: number;
  sellPrice: number;
  luongBought: number;  // fixed quantity per period
  cumLuong: number;
  periodCost: number;   // luongBought × buyPrice (VND spent at Giá Bán Ra)
  cumCost: number;      // total VND spent
  portfolioValue: number; // cumLuong × sellPrice (valued at Giá Mua Vào)
}

export interface SjcDcaResult {
  entries: SjcDcaEntry[];
  totalLuong: number;
  totalCost: number;    // total VND spent
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
}

interface VangTodayHistoryEntry {
  date: string;
  prices: {
    SJL1L10: {
      buy: number;
      sell: number;
    };
  };
}

interface VangTodayHistoryResponse {
  success: boolean;
  history: VangTodayHistoryEntry[];
}

@Injectable({ providedIn: 'root' })
export class SjcService {
  private http = inject(HttpClient);

  getPriceHistory(days = 30): Observable<SjcPricePoint[]> {
    return this.http
      .get<VangTodayHistoryResponse>('/api/vang-today/api/prices', {
        params: { type: 'SJL1L10', days: String(days) },
      })
      .pipe(
        map(r =>
          (r.history ?? [])
            .filter(e => e.prices?.SJL1L10?.buy > 0)
            .map(e => ({
              date: e.date,
              buy: e.prices.SJL1L10.buy,
              sell: e.prices.SJL1L10.sell,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        ),
        catchError(() => of([])),
      );
  }
}
