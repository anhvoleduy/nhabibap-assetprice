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
import { DecimalPipe } from '@angular/common';
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
import { SjcService, SjcPricePoint, SjcDcaResult } from '../sjc.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

Chart.register(CategoryScale, LinearScale, LineController, PointElement, LineElement, Tooltip, Legend, Filler);

const CHI_PER_LUONG = 10;

@Component({
  selector: 'app-sjc-page',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './sjc-page.component.html',
  styleUrl: './sjc-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SjcPageComponent {
  private sjcService = inject(SjcService);
  private destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly priceHistory = signal<SjcPricePoint[]>([]);

  readonly lastBuy = computed(() => this.priceHistory().at(-1)?.buy ?? 0);
  readonly lastSell = computed(() => this.priceHistory().at(-1)?.sell ?? 0);
  readonly firstBuy = computed(() => this.priceHistory().at(0)?.buy ?? 0);
  readonly change = computed(() => this.lastBuy() - this.firstBuy());
  readonly changePct = computed(() =>
    this.firstBuy() ? (this.change() / this.firstBuy()) * 100 : 0,
  );
  readonly spread = computed(() =>
    this.lastBuy() ? ((this.lastBuy() - this.lastSell()) / this.lastBuy()) * 100 : 0,
  );
  readonly periodHigh = computed(() =>
    this.priceHistory().reduce((max, p) => Math.max(max, p.buy), 0),
  );
  readonly periodLow = computed(() =>
    this.priceHistory().reduce((min, p) => Math.min(min, p.buy), Infinity),
  );

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  readonly dcaStartDate = signal(this.thirtyDaysAgo());
  readonly dcaQuantity = signal(1);
  readonly dcaUnit = signal<'luong' | 'chi'>('chi');
  readonly dcaFrequency = signal<'weekly' | 'monthly'>('weekly');
  readonly dcaResult = signal<SjcDcaResult | null>(null);
  readonly dcaLoading = signal(false);
  readonly dcaError = signal<string | null>(null);
  readonly dcaWarning = signal<string | null>(null);

  readonly maxDcaDate = new Date().toISOString().split('T')[0];
  readonly minDcaDate = '2022-01-01';

  private chart: Chart | null = null;

  constructor() {
    effect(onCleanup => {
      this.loading.set(true);
      this.error.set(null);
      this.priceHistory.set([]);

      const sub = this.sjcService.getPriceHistory().subscribe({
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

  formatVnd(value: number): string {
    return value.toLocaleString('en-US');
  }

  formatVndM(value: number): string {
    return (value / 1_000_000).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  onDcaDateChange(e: Event): void {
    this.dcaStartDate.set((e.target as HTMLInputElement).value);
  }

  onDcaQuantityChange(e: Event): void {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(v) && v > 0) this.dcaQuantity.set(v);
  }

  onDcaUnitChange(unit: 'luong' | 'chi'): void {
    this.dcaUnit.set(unit);
  }

  onDcaFrequencyChange(freq: 'weekly' | 'monthly'): void {
    this.dcaFrequency.set(freq);
  }

  runSimulation(): void {
    const startDate = this.dcaStartDate();
    const quantity = this.dcaQuantity();
    const unit = this.dcaUnit();
    const frequency = this.dcaFrequency();
    if (!startDate || quantity <= 0) return;

    const luongPerPeriod = unit === 'chi' ? quantity / CHI_PER_LUONG : quantity;
    const daysNeeded = Math.ceil((Date.now() - new Date(startDate).getTime()) / MS_PER_DAY) + 1;

    this.dcaLoading.set(true);
    this.dcaError.set(null);
    this.dcaWarning.set(null);
    this.dcaResult.set(null);

    this.sjcService
      .getPriceHistory(daysNeeded)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: history => {
          this.dcaLoading.set(false);
          const dcaDates = this.buildDcaDates(startDate, frequency);
          const prices = dcaDates
            .map(date => this.findNearestPrice(history, date))
            .filter((p): p is SjcPricePoint => p !== null);

          if (!prices.length) {
            this.dcaError.set('Không có dữ liệu giá cho khoảng thời gian đã chọn.');
            return;
          }

          if (prices[0].date > startDate) {
            this.dcaWarning.set(`Dữ liệu chỉ có từ ${prices[0].date}. Mô phỏng bắt đầu từ ngày đó.`);
          }

          let cumLuong = 0;
          let cumCost = 0;
          const entries = prices.map(p => {
            const periodCost = luongPerPeriod * p.sell;
            cumLuong += luongPerPeriod;
            cumCost += periodCost;
            return {
              date: p.date,
              buyPrice: p.sell,
              sellPrice: p.buy,
              luongBought: luongPerPeriod,
              cumLuong,
              periodCost,
              cumCost,
              portfolioValue: cumLuong * p.buy,
            };
          });

          const last = entries.at(-1)!;
          const todayBuy = history.at(-1)?.buy ?? 0;
          const currentValue = last.cumLuong * todayBuy;
          this.dcaResult.set({
            entries,
            totalLuong: last.cumLuong,
            totalCost: last.cumCost,
            currentValue,
            gainLoss: currentValue - last.cumCost,
            gainLossPct: ((currentValue - last.cumCost) / last.cumCost) * 100,
          });
        },
        error: () => {
          this.dcaLoading.set(false);
          this.dcaError.set('Không thể tải dữ liệu giá.');
        },
      });
  }

  private thirtyDaysAgo(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }

  private buildDcaDates(startDate: string, frequency: 'weekly' | 'monthly'): string[] {
    const dates: string[] = [];
    const current = new Date(startDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (current <= today) {
      dates.push(current.toISOString().split('T')[0]);
      frequency === 'weekly'
        ? current.setDate(current.getDate() + 7)
        : current.setMonth(current.getMonth() + 1);
    }
    return dates;
  }

  private findNearestPrice(history: SjcPricePoint[], date: string): SjcPricePoint | null {
    const target = new Date(date).getTime();
    let best: SjcPricePoint | null = null;
    let bestDiff = 3 * MS_PER_DAY;
    for (const p of history) {
      const diff = Math.abs(new Date(p.date).getTime() - target);
      if (diff <= bestDiff) { bestDiff = diff; best = p; }
    }
    return best;
  }

  private renderChart(canvas: HTMLCanvasElement, data: SjcPricePoint[]): void {
    this.chart?.destroy();

    const buyColor = '#2563eb';
    const sellColor = '#f97316';

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Giá Mua Vào',
            data: data.map(d => d.buy),
            borderColor: buyColor,
            backgroundColor: `${buyColor}1a`,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Giá Bán Ra',
            data: data.map(d => d.sell),
            borderColor: sellColor,
            backgroundColor: `${sellColor}1a`,
            fill: false,
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
          legend: { display: true, position: 'top', labels: { color: '#64748b', font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx =>
                ` ${ctx.dataset.label}: ₫${Number(ctx.parsed.y).toLocaleString('en-US')} / lượng`,
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
              callback: v => `₫${(Number(v) / 1_000_000).toFixed(0)}M`,
            },
          },
        },
      },
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }
}
