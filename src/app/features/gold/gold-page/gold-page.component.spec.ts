import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { GoldPageComponent } from './gold-page.component';
import { GoldService, PricePoint } from '../gold.service';

const MOCK_PRICES: PricePoint[] = [
  { date: '2025-01-01', close: 2600 },
  { date: '2025-01-02', close: 2750 },
  { date: '2025-01-03', close: 2500 },
];

describe('GoldPageComponent', () => {
  let component: GoldPageComponent;
  let fixture: ComponentFixture<GoldPageComponent>;
  let mockService: { getPriceHistory: ReturnType<typeof vi.fn>; getDcaPrices: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      getPriceHistory: vi.fn().mockReturnValue(of([])),
      getDcaPrices: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [GoldPageComponent],
      providers: [{ provide: GoldService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GoldPageComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'renderChart').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults selectedRange to 365 days', () => {
    expect(component.selectedRange()).toBe(365);
  });

  describe('computed signals', () => {
    beforeEach(() => {
      component.priceHistory.set(MOCK_PRICES);
    });

    it('lastPrice returns last close', () => {
      expect(component.lastPrice()).toBe(2500);
    });

    it('firstPrice returns first close', () => {
      expect(component.firstPrice()).toBe(2600);
    });

    it('change computes correctly', () => {
      expect(component.change()).toBe(-100);
    });

    it('changePct computes correctly', () => {
      expect(component.changePct()).toBeCloseTo(-3.846, 2);
    });

    it('periodHigh returns maximum close', () => {
      expect(component.periodHigh()).toBe(2750);
    });

    it('periodLow returns minimum close', () => {
      expect(component.periodLow()).toBe(2500);
    });

    it('changePct is 0 when priceHistory is empty', () => {
      component.priceHistory.set([]);
      expect(component.changePct()).toBe(0);
    });
  });

  describe('onRangeChange', () => {
    it('updates selectedRange signal', () => {
      component.onRangeChange(90);
      expect(component.selectedRange()).toBe(90);
    });
  });

  describe('onDcaAmountChange', () => {
    it('updates amount for valid positive values', () => {
      const event = { target: { value: '500' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(500);
    });

    it('ignores non-positive values', () => {
      component.dcaAmount.set(100);
      const event = { target: { value: '-1' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(100);
    });
  });

  describe('onDcaFrequencyChange', () => {
    it('updates dcaFrequency', () => {
      component.onDcaFrequencyChange('weekly');
      expect(component.dcaFrequency()).toBe('weekly');
    });
  });

  describe('formatPrice', () => {
    it('formats with 2 decimal places', () => {
      expect(component.formatPrice(2750)).toBe('2,750.00');
    });
  });

  describe('runSimulation', () => {
    it('calculates oz accumulation correctly', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 2500 },
        { date: '2025-02-01', close: 5000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(100);

      component.runSimulation();

      const result = component.dcaResult();
      expect(result).not.toBeNull();
      expect(result!.totalInvested).toBe(200);
      expect(result!.totalOz).toBeCloseTo(0.04 + 0.02, 6);
    });

    it('sets dcaError when no prices returned', () => {
      mockService.getDcaPrices.mockReturnValue(of([]));
      component.runSimulation();
      expect(component.dcaError()).toBe('No price data found for the selected date range.');
    });

    it('does not call service when amount <= 0', () => {
      mockService.getDcaPrices.mockClear();
      component.dcaAmount.set(0);
      component.runSimulation();
      expect(mockService.getDcaPrices).not.toHaveBeenCalled();
    });

    it('sets dcaError on service error', () => {
      const error$ = new Subject<PricePoint[]>();
      mockService.getDcaPrices.mockReturnValue(error$.asObservable());
      component.dcaAmount.set(100);
      component.runSimulation();
      error$.error(new Error('network'));
      expect(component.dcaError()).toBe('Failed to fetch price data.');
    });

    it('gainLoss is positive when portfolio beats investment', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 1000 },
        { date: '2025-02-01', close: 2000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(100);
      component.runSimulation();
      expect(component.dcaResult()!.gainLoss).toBeGreaterThan(0);
    });
  });
});
