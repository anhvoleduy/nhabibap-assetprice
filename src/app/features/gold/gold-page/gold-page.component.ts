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
import { GoldService, PricePoint } from '../gold.service';

Chart.register(CategoryScale, LinearScale, LineController, PointElement, LineElement, Tooltip, Legend, Filler);

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
] as const;

@Component({
  selector: 'app-gold-page',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './gold-page.component.html',
  styleUrl: './gold-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoldPageComponent {
  private goldService = inject(GoldService);
  private destroyRef = inject(DestroyRef);

  readonly ranges = RANGES;

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

  private chart: Chart | null = null;

  constructor() {
    effect(onCleanup => {
      const days = this.selectedRange();

      this.loading.set(true);
      this.error.set(null);
      this.priceHistory.set([]);

      const sub = this.goldService.getPriceHistory(days).subscribe({
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

  onRangeChange(days: (typeof RANGES)[number]['days']): void {
    this.selectedRange.set(days);
  }

  formatPrice(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private renderChart(canvas: HTMLCanvasElement, data: PricePoint[]): void {
    this.chart?.destroy();

    const prices = data.map(d => d.close);
    const isPositive = prices[prices.length - 1] >= prices[0];
    const color = isPositive ? '#16a34a' : '#dc2626';

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Gold (USD/oz)',
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
              label: ctx =>
                ` $${Number(ctx.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
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
              callback: v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
            },
          },
        },
      },
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }
}
