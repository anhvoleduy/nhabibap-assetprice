import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { FiatPageComponent } from './fiat-page.component';
import { FiatService, FIAT_CURRENCIES, PricePoint } from '../fiat.service';

const MOCK_PRICES: PricePoint[] = [
  { date: '2025-01-01', close: 1.05 },
  { date: '2025-01-02', close: 1.10 },
  { date: '2025-01-03', close: 1.08 },
];

describe('FiatPageComponent', () => {
  let component: FiatPageComponent;
  let fixture: ComponentFixture<FiatPageComponent>;
  let mockService: { getPriceHistory: ReturnType<typeof vi.fn>; getDcaPrices: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      getPriceHistory: vi.fn().mockReturnValue(of([])),
      getDcaPrices: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [FiatPageComponent],
      providers: [{ provide: FiatService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(FiatPageComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'renderChart').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes full currency list', () => {
    expect(component.currencies).toBe(FIAT_CURRENCIES);
    expect(component.currencies.length).toBe(10);
  });

  it('defaults selectedCurrency to EUR', () => {
    expect(component.selectedCurrency().code).toBe('eur');
  });

  it('defaults selectedRange to 365 days', () => {
    expect(component.selectedRange()).toBe(365);
  });

  describe('computed price signals', () => {
    beforeEach(() => {
      component.priceHistory.set(MOCK_PRICES);
    });

    it('lastPrice returns last close', () => {
      expect(component.lastPrice()).toBe(1.08);
    });

    it('firstPrice returns first close', () => {
      expect(component.firstPrice()).toBe(1.05);
    });

    it('change computes difference', () => {
      expect(component.change()).toBeCloseTo(0.03, 4);
    });

    it('changePct computes percentage', () => {
      expect(component.changePct()).toBeCloseTo(2.857, 2);
    });

    it('periodHigh returns max', () => {
      expect(component.periodHigh()).toBe(1.10);
    });

    it('periodLow returns min', () => {
      expect(component.periodLow()).toBe(1.05);
    });

    it('changePct is 0 when priceHistory is empty', () => {
      component.priceHistory.set([]);
      expect(component.changePct()).toBe(0);
    });
  });

  describe('onCurrencyChange', () => {
    it('updates selectedCurrency signal', () => {
      component.onCurrencyChange(FIAT_CURRENCIES[3]); // jpy
      expect(component.selectedCurrency().code).toBe('jpy');
    });
  });

  describe('onRangeChange', () => {
    it('updates selectedRange signal', () => {
      component.onRangeChange(30);
      expect(component.selectedRange()).toBe(30);
    });
  });

  describe('onDcaAmountChange', () => {
    it('updates dcaAmount for positive values', () => {
      const event = { target: { value: '250' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(250);
    });

    it('ignores zero value', () => {
      component.dcaAmount.set(100);
      const event = { target: { value: '0' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(100);
    });
  });

  describe('onDcaFrequencyChange', () => {
    it('updates dcaFrequency signal', () => {
      component.onDcaFrequencyChange('weekly');
      expect(component.dcaFrequency()).toBe('weekly');
    });
  });

  describe('onDcaDateChange', () => {
    it('updates dcaStartDate signal', () => {
      const event = { target: { value: '2023-06-01' } } as unknown as Event;
      component.onDcaDateChange(event);
      expect(component.dcaStartDate()).toBe('2023-06-01');
    });
  });

  describe('formatRate', () => {
    it('uses 4 decimal places for values >= 0.01', () => {
      expect(component.formatRate(1.0987)).toBe('1.0987');
    });

    it('uses 6 decimal places for values < 0.01', () => {
      expect(component.formatRate(0.0065)).toBe('0.006500');
    });
  });

  describe('formatUnits', () => {
    it('uses 2 decimal places for values >= 0.01', () => {
      expect(component.formatUnits(100.5)).toBe('100.50');
    });

    it('uses 6 decimal places for small values', () => {
      expect(component.formatUnits(0.005)).toBe('0.005000');
    });
  });

  describe('runSimulation', () => {
    it('calculates unit accumulation and result', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 1.0 },
        { date: '2025-02-01', close: 2.0 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(100);

      component.runSimulation();

      const result = component.dcaResult();
      expect(result).not.toBeNull();
      expect(result!.totalInvested).toBe(200);
      expect(result!.totalUnits).toBeCloseTo(100 + 50, 4);
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
      expect(component.dcaLoading()).toBe(false);
    });

    it('clears previous result before new simulation', () => {
      component.dcaResult.set({
        entries: [],
        totalInvested: 0,
        totalUnits: 0,
        currentValue: 0,
        gainLoss: 0,
        gainLossPct: 0,
      });
      mockService.getDcaPrices.mockReturnValue(of([]));
      component.runSimulation();
      expect(component.dcaResult()).toBeNull();
      expect(component.dcaError()).toBeTruthy();
    });
  });
});
