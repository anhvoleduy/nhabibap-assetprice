import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { BitcoinPageComponent } from './bitcoin-page.component';
import { BitcoinService, PricePoint } from '../bitcoin.service';

const MOCK_PRICES: PricePoint[] = [
  { date: '2025-01-01', close: 50000 },
  { date: '2025-01-02', close: 55000 },
  { date: '2025-01-03', close: 45000 },
];

describe('BitcoinPageComponent', () => {
  let component: BitcoinPageComponent;
  let fixture: ComponentFixture<BitcoinPageComponent>;
  let mockService: { getPriceHistory: ReturnType<typeof vi.fn>; getDcaPrices: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      getPriceHistory: vi.fn().mockReturnValue(of([])),
      getDcaPrices: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [BitcoinPageComponent],
      providers: [{ provide: BitcoinService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BitcoinPageComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'renderChart').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has 5 range options', () => {
    expect(component.ranges.length).toBe(5);
  });

  it('defaults selectedRange to 365 days', () => {
    expect(component.selectedRange()).toBe(365);
  });

  describe('computed signals', () => {
    beforeEach(() => {
      component.priceHistory.set(MOCK_PRICES);
    });

    it('lastPrice returns last close', () => {
      expect(component.lastPrice()).toBe(45000);
    });

    it('firstPrice returns first close', () => {
      expect(component.firstPrice()).toBe(50000);
    });

    it('change returns difference (last - first)', () => {
      expect(component.change()).toBe(-5000);
    });

    it('changePct returns percentage change', () => {
      expect(component.changePct()).toBeCloseTo(-10, 1);
    });

    it('periodHigh returns maximum close price', () => {
      expect(component.periodHigh()).toBe(55000);
    });

    it('periodLow returns minimum close price', () => {
      expect(component.periodLow()).toBe(45000);
    });

    it('changePct returns 0 when priceHistory is empty', () => {
      component.priceHistory.set([]);
      expect(component.changePct()).toBe(0);
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

    it('ignores negative value', () => {
      component.dcaAmount.set(100);
      const event = { target: { value: '-50' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(100);
    });

    it('ignores non-numeric input', () => {
      component.dcaAmount.set(100);
      const event = { target: { value: 'abc' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(100);
    });
  });

  describe('onDcaFrequencyChange', () => {
    it('updates dcaFrequency signal', () => {
      component.onDcaFrequencyChange('weekly');
      expect(component.dcaFrequency()).toBe('weekly');
      component.onDcaFrequencyChange('monthly');
      expect(component.dcaFrequency()).toBe('monthly');
    });
  });

  describe('onDcaDateChange', () => {
    it('updates dcaStartDate signal', () => {
      const event = { target: { value: '2024-01-01' } } as unknown as Event;
      component.onDcaDateChange(event);
      expect(component.dcaStartDate()).toBe('2024-01-01');
    });
  });

  describe('formatPrice', () => {
    it('formats with 2 decimal places', () => {
      expect(component.formatPrice(50000)).toBe('50,000.00');
    });

    it('formats small values', () => {
      expect(component.formatPrice(1.5)).toBe('1.50');
    });
  });

  describe('runSimulation', () => {
    it('calculates DCA entries and result correctly', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 50000 },
        { date: '2025-02-01', close: 40000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(100);
      component.dcaFrequency.set('monthly');

      component.runSimulation();

      const result = component.dcaResult();
      expect(result).not.toBeNull();
      expect(result!.totalInvested).toBe(200);
      expect(result!.totalBtc).toBeCloseTo(0.002 + 0.0025, 6);
      expect(result!.entries.length).toBe(2);
    });

    it('sets dcaError when prices array is empty', () => {
      mockService.getDcaPrices.mockReturnValue(of([]));
      component.runSimulation();
      expect(component.dcaError()).toBe('No price data found for the selected date range.');
    });

    it('does not call service when amount is zero', () => {
      mockService.getDcaPrices.mockClear();
      component.dcaAmount.set(0);
      component.runSimulation();
      expect(mockService.getDcaPrices).not.toHaveBeenCalled();
    });

    it('sets dcaLoading false after success', () => {
      mockService.getDcaPrices.mockReturnValue(of([{ date: '2025-01-01', close: 50000 }]));
      component.dcaAmount.set(100);
      component.runSimulation();
      expect(component.dcaLoading()).toBe(false);
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

    it('cumulative BTC accumulates across entries', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 100 },
        { date: '2025-02-01', close: 200 },
        { date: '2025-03-01', close: 400 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(100);
      component.runSimulation();

      const entries = component.dcaResult()!.entries;
      expect(entries[0].cumBtc).toBeCloseTo(1, 6);
      expect(entries[1].cumBtc).toBeCloseTo(1.5, 6);
      expect(entries[2].cumBtc).toBeCloseTo(1.75, 6);
    });
  });
});
