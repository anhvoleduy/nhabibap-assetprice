import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { FiatService, FIAT_CURRENCIES, PricePoint, DcaResult } from '../fiat.service';

Chart.register(CategoryScale, LinearScale, LineController, PointElement, LineElement, Tooltip, Legend, Filler);

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
] as const;

@Component({
  selector: 'app-fiat-page',
  standalone: true,
  imports: [DecimalPipe, UpperCasePipe],
  templateUrl: './fiat-page.component.html',
  styleUrl: './fiat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiatPageComponent {
  private fiatService = inject(FiatService);
  private destroyRef = inject(DestroyRef);

  readonly currencies = FIAT_CURRENCIES;
  readonly ranges = RANGES;

  readonly selectedCurrency = signal(FIAT_CURRENCIES[0]);
  readonly selectedRange = signal<(typeof RANGES)[number]['days']>(365);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly priceHistory = signal<PricePoint[]>([]);

  readonly lastPrice = computed(() => this.priceHistory().at(-1)?.close ?? 0);
  readonly firstPrice = computed(() => this.priceHistory().at(0)?.close ?? 0);
  readonly change = computed(() => this.lastPrice() - this.firstPrice());
  readonly changePct = computed(() =>
    this.firstPrice() ? (this.change() / this.firstPrice()) * 100 : 0,
  );
  readonly periodHigh = computed(() =>
    this.priceHistory().reduce((max, p) => Math.max(max, p.close), 0),
  );
  readonly periodLow = computed(() =>
    this.priceHistory().reduce((min, p) => Math.min(min, p.close), Infinity),
  );

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  readonly dcaStartDate = signal(this.oneYearAgo());
  readonly dcaAmount = signal(100);
  readonly dcaFrequency = signal<'weekly' | 'monthly'>('monthly');
  readonly dcaResult = signal<DcaResult | null>(null);
  readonly dcaLoading = signal(false);
  readonly dcaError = signal<string | null>(null);

  readonly maxDcaDate = new Date().toISOString().split('T')[0];
  readonly minDcaDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 10);
    return d.toISOString().split('T')[0];
  })();

  private chart: Chart | null = null;

  constructor() {
    effect(onCleanup => {
      const currency = this.selectedCurrency();
      const days = this.selectedRange();

      this.loading.set(true);
      this.error.set(null);
      this.priceHistory.set([]);
      this.dcaResult.set(null);

      const sub = this.fiatService.getPriceHistory(currency.code, days).subscribe({
        next: data => {
          this.priceHistory.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load price data. Check network or try again.');
          this.loading.set(false);
        },
      });

      onCleanup(() => sub.unsubscribe());
    });

    effect(() => {
      const data = this.priceHistory();
      const canvasEl = this.canvasRef();
      if (!canvasEl || !data.length) return;
      this.renderChart(canvasEl.nativeElement, data);
    });
  }

  onCurrencyChange(currency: (typeof FIAT_CURRENCIES)[number]): void {
    this.selectedCurrency.set(currency);
  }

  onRangeChange(days: (typeof RANGES)[number]['days']): void {
    this.selectedRange.set(days);
  }

  formatRate(value: number): string {
    const decimals = value < 0.01 ? 6 : 4;
    return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  formatUnits(value: number): string {
    const decimals = value < 0.01 ? 6 : 2;
    return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  onDcaDateChange(e: Event): void {
    this.dcaStartDate.set((e.target as HTMLInputElement).value);
  }

  onDcaAmountChange(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) this.dcaAmount.set(v);
  }

  onDcaFrequencyChange(freq: 'weekly' | 'monthly'): void {
    this.dcaFrequency.set(freq);
  }

  runSimulation(): void {
    const currency = this.selectedCurrency();
    const startDate = this.dcaStartDate();
    const amount = this.dcaAmount();
    const frequency = this.dcaFrequency();
    if (!startDate || amount <= 0) return;

    this.dcaLoading.set(true);
    this.dcaError.set(null);
    this.dcaResult.set(null);

    this.fiatService
      .getDcaPrices(currency.code, startDate, frequency)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prices => {
          if (!prices.length) {
            this.dcaError.set('No price data found for the selected date range.');
            this.dcaLoading.set(false);
            return;
          }

          let cumUnits = 0;
          let cumInvested = 0;
          const entries = prices.map(p => {
            const unitsBought = amount / p.close;
            cumUnits += unitsBought;
            cumInvested += amount;
            return { date: p.date, price: p.close, unitsBought, cumUnits, cumInvested, portfolioValue: cumUnits * p.close };
          });

          const last = entries.at(-1)!;
          const currentValue = last.cumUnits * this.lastPrice();
          this.dcaResult.set({
            entries,
            totalInvested: last.cumInvested,
            totalUnits: last.cumUnits,
            currentValue,
            gainLoss: currentValue - last.cumInvested,
            gainLossPct: ((currentValue - last.cumInvested) / last.cumInvested) * 100,
          });
          this.dcaLoading.set(false);
        },
        error: () => {
          this.dcaError.set('Failed to fetch price data.');
          this.dcaLoading.set(false);
        },
      });
  }

  private oneYearAgo(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  }

  private renderChart(canvas: HTMLCanvasElement, data: PricePoint[]): void {
    this.chart?.destroy();

    const prices = data.map(d => d.close);
    const isPositive = prices[prices.length - 1] >= prices[0];
    const color = isPositive ? '#16a34a' : '#dc2626';
    const currency = this.selectedCurrency();

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: `${currency.code.toUpperCase()} / USD`,
            data: prices,
            borderColor: color,
            backgroundColor: `${color}1a`,
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` $${this.formatRate(Number(ctx.parsed.y))} USD`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: { maxTicksLimit: 8, color: '#64748b', font: { size: 11 } },
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: v => `$${this.formatRate(Number(v))}`,
            },
          },
        },
      },
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }
}
