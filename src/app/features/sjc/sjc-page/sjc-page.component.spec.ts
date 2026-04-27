import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { SjcPageComponent } from './sjc-page.component';
import { SjcService, SjcPricePoint } from '../sjc.service';

const MOCK_PRICES: SjcPricePoint[] = [
  { date: '2025-01-01', buy: 165_000_000, sell: 162_500_000 },
  { date: '2025-02-01', buy: 170_000_000, sell: 167_450_000 },
  { date: '2025-03-01', buy: 168_000_000, sell: 165_480_000 },
];

describe('SjcPageComponent', () => {
  let component: SjcPageComponent;
  let fixture: ComponentFixture<SjcPageComponent>;
  let mockService: { getPriceHistory: ReturnType<typeof vi.fn>; getDcaPrices: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      getPriceHistory: vi.fn().mockReturnValue(of([])),
      getDcaPrices: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [SjcPageComponent],
      providers: [{ provide: SjcService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SjcPageComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'renderChart').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults dcaUnit to chỉ', () => {
    expect(component.dcaUnit()).toBe('chi');
  });

  it('defaults dcaQuantity to 1', () => {
    expect(component.dcaQuantity()).toBe(1);
  });

  describe('computed signals', () => {
    beforeEach(() => {
      component.priceHistory.set(MOCK_PRICES);
    });

    it('lastBuy returns last buy price', () => {
      expect(component.lastBuy()).toBe(168_000_000);
    });

    it('lastSell returns last sell price', () => {
      expect(component.lastSell()).toBe(165_480_000);
    });

    it('change computes correctly (buy prices)', () => {
      expect(component.change()).toBe(3_000_000);
    });

    it('periodHigh returns max buy', () => {
      expect(component.periodHigh()).toBe(170_000_000);
    });

    it('periodLow returns min buy', () => {
      expect(component.periodLow()).toBe(165_000_000);
    });

    it('changePct is 0 when priceHistory is empty', () => {
      component.priceHistory.set([]);
      expect(component.changePct()).toBe(0);
    });
  });

  describe('onDcaQuantityChange', () => {
    it('updates quantity for valid positive values', () => {
      const event = { target: { value: '2' } } as unknown as Event;
      component.onDcaQuantityChange(event);
      expect(component.dcaQuantity()).toBe(2);
    });

    it('ignores non-positive values', () => {
      component.dcaQuantity.set(1);
      const event = { target: { value: '-1' } } as unknown as Event;
      component.onDcaQuantityChange(event);
      expect(component.dcaQuantity()).toBe(1);
    });
  });

  describe('onDcaUnitChange', () => {
    it('switches to lượng', () => {
      component.onDcaUnitChange('luong');
      expect(component.dcaUnit()).toBe('luong');
    });

    it('switches to chỉ', () => {
      component.onDcaUnitChange('luong');
      component.onDcaUnitChange('chi');
      expect(component.dcaUnit()).toBe('chi');
    });
  });

  describe('onDcaFrequencyChange', () => {
    it('updates dcaFrequency', () => {
      component.onDcaFrequencyChange('weekly');
      expect(component.dcaFrequency()).toBe('weekly');
    });
  });

  describe('runSimulation – quantity-based DCA', () => {
    it('buys fixed lượng each period when unit is lượng', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
        { date: '2025-02-01', buy: 120_000_000, sell: 117_000_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(1);
      component.onDcaUnitChange('luong');

      component.runSimulation();

      const result = component.dcaResult();
      expect(result).not.toBeNull();
      expect(result!.totalLuong).toBeCloseTo(2, 6);
    });

    it('converts chỉ to lượng (1 chỉ = 0.1 lượng)', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(5); // 5 chỉ = 0.5 lượng
      component.onDcaUnitChange('chi');

      component.runSimulation();

      const result = component.dcaResult();
      expect(result!.totalLuong).toBeCloseTo(0.5, 6);
    });

    it('calculates periodCost = luongBought × buyPrice', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(1);
      component.onDcaUnitChange('luong');

      component.runSimulation();

      const result = component.dcaResult();
      // 1 lượng × 100,000,000 = 100,000,000 VND
      expect(result!.entries[0].periodCost).toBeCloseTo(100_000_000, 0);
      expect(result!.totalCost).toBeCloseTo(100_000_000, 0);
    });

    it('calculates portfolio value using sell price', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(1);
      component.onDcaUnitChange('luong');

      component.runSimulation();

      const result = component.dcaResult();
      // 1 lượng × 97,500,000 sell = 97,500,000
      expect(result!.currentValue).toBeCloseTo(97_500_000, 0);
    });

    it('gainLoss reflects buy/sell spread (immediate loss on 1 period)', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(1);
      component.onDcaUnitChange('luong');

      component.runSimulation();

      // cost 100M, value 97.5M → loss of 2.5M
      expect(component.dcaResult()!.gainLoss).toBeCloseTo(-2_500_000, 0);
    });

    it('gainLoss is positive when gold appreciated', () => {
      const prices: SjcPricePoint[] = [
        { date: '2025-01-01', buy: 100_000_000, sell: 97_500_000 },
        { date: '2025-02-01', buy: 200_000_000, sell: 195_000_000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaQuantity.set(1);
      component.onDcaUnitChange('luong');

      component.runSimulation();

      expect(component.dcaResult()!.gainLoss).toBeGreaterThan(0);
    });

    it('sets dcaError when no prices returned', () => {
      mockService.getDcaPrices.mockReturnValue(of([]));
      component.runSimulation();
      expect(component.dcaError()).toBe('No price data found for the selected date range.');
    });

    it('does not call service when quantity <= 0', () => {
      mockService.getDcaPrices.mockClear();
      component.dcaQuantity.set(0);
      component.runSimulation();
      expect(mockService.getDcaPrices).not.toHaveBeenCalled();
    });

    it('sets dcaError on service error', () => {
      const error$ = new Subject<SjcPricePoint[]>();
      mockService.getDcaPrices.mockReturnValue(error$.asObservable());
      component.dcaQuantity.set(1);
      component.runSimulation();
      error$.error(new Error('network'));
      expect(component.dcaError()).toBe('Failed to fetch price data.');
    });
  });
});
