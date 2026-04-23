import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface PricePoint {
  date: string;
  close: number;
}

interface CurrencyApiResponse {
  date: string;
  xau: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class GoldService {
  private http = inject(HttpClient);

  private readonly BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api';

  getPriceHistory(days: number): Observable<PricePoint[]> {
    const step = days <= 90 ? 1 : days <= 365 ? 5 : 7;
    const dates = this.buildDateRange(days, step);

    const requests = dates.map(date =>
      this.http
        .get<CurrencyApiResponse>(`${this.BASE}@${date}/v1/currencies/xau.min.json`)
        .pipe(
          map(r => ({ date: r.date ?? date, close: r.xau['usd'] ?? 0 })),
          catchError(() => of(null)),
        ),
    );

    return forkJoin(requests).pipe(
      map(results =>
        results
          .filter((r): r is PricePoint => r !== null && r.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date)),
      ),
    );
  }

  private buildDateRange(days: number, step: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = days; i >= 0; i -= step) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }
}
