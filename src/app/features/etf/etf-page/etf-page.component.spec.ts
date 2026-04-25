import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { EtfPageComponent } from './etf-page.component';
import { EtfService, VnEtf, PricePoint } from '../etf.service';

const MOCK_ETFS: VnEtf[] = [
  { code: 'E1VFVN30', label: 'DCVFMVN30', index: 'VN30' },
  { code: 'FUEABVND', label: 'ABFVN DIAMOND', index: 'VN DIAMOND' },
  { code: 'FUESSV30', label: 'SSIAM VN30', index: 'VN30' },
];

const MOCK_PRICES: PricePoint[] = [
  { date: '2025-01-01', close: 14000 },
  { date: '2025-01-02', close: 15000 },
  { date: '2025-01-03', close: 13000 },
];

describe('EtfPageComponent', () => {
  let component: EtfPageComponent;
  let fixture: ComponentFixture<EtfPageComponent>;
  let mockService: {
    getEtfList: ReturnType<typeof vi.fn>;
    getPriceHistory: ReturnType<typeof vi.fn>;
    getDcaPrices: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      getEtfList: vi.fn().mockReturnValue(of(MOCK_ETFS)),
      getPriceHistory: vi.fn().mockReturnValue(of([])),
      getDcaPrices: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [EtfPageComponent],
      providers: [{ provide: EtfService, useValue: mockService }],
    }).compileComponents();

    fixture = TestBed.createComponent(EtfPageComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'renderChart').mockImplementation(() => {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads ETF list on init', () => {
    expect(component.etfs().length).toBe(3);
    expect(component.etfListLoading()).toBe(false);
  });

  it('auto-selects first ETF', () => {
    expect(component.selectedEtf()?.code).toBe('E1VFVN30');
  });

  it('defaults selectedRange to 365 days', () => {
    expect(component.selectedRange()).toBe(365);
  });

  describe('filteredEtfs computed', () => {
    it('returns all ETFs when search is empty', () => {
      component.searchQuery.set('');
      expect(component.filteredEtfs().length).toBe(3);
    });

    it('filters by code (case-insensitive)', () => {
      component.searchQuery.set('vn30');
      const filtered = component.filteredEtfs();
      expect(filtered.length).toBeGreaterThan(0);
      expect(
        filtered.every(
          e =>
            e.code.toLowerCase().includes('vn30') ||
            e.label.toLowerCase().includes('vn30') ||
            e.index.toLowerCase().includes('vn30'),
        ),
      ).toBe(true);
    });

    it('filters by label', () => {
      component.searchQuery.set('diamond');
      const filtered = component.filteredEtfs();
      expect(filtered.length).toBeGreaterThan(0);
      expect(
        filtered.every(
          e =>
            e.label.toLowerCase().includes('diamond') || e.index.toLowerCase().includes('diamond'),
        ),
      ).toBe(true);
    });

    it('returns empty when query matches nothing', () => {
      component.searchQuery.set('zzznomatch');
      expect(component.filteredEtfs().length).toBe(0);
    });
  });

  describe('computed price signals', () => {
    beforeEach(() => {
      component.priceHistory.set(MOCK_PRICES);
    });

    it('lastPrice returns last close', () => {
      expect(component.lastPrice()).toBe(13000);
    });

    it('firstPrice returns first close', () => {
      expect(component.firstPrice()).toBe(14000);
    });

    it('periodHigh returns max close', () => {
      expect(component.periodHigh()).toBe(15000);
    });

    it('periodLow returns min close', () => {
      expect(component.periodLow()).toBe(13000);
    });

    it('change is negative when price fell', () => {
      expect(component.change()).toBe(-1000);
    });
  });

  describe('onEtfChange', () => {
    it('updates selectedEtf signal', () => {
      component.onEtfChange(MOCK_ETFS[1]);
      expect(component.selectedEtf()?.code).toBe('FUEABVND');
    });
  });

  describe('onRangeChange', () => {
    it('updates selectedRange signal', () => {
      component.onRangeChange(180);
      expect(component.selectedRange()).toBe(180);
    });
  });

  describe('onSearchChange', () => {
    it('updates searchQuery signal', () => {
      const event = { target: { value: 'VN30' } } as unknown as Event;
      component.onSearchChange(event);
      expect(component.searchQuery()).toBe('VN30');
    });
  });

  describe('onDcaAmountChange', () => {
    it('updates dcaAmount for positive values', () => {
      const event = { target: { value: '5000000' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(5000000);
    });

    it('ignores zero', () => {
      component.dcaAmount.set(1000000);
      const event = { target: { value: '0' } } as unknown as Event;
      component.onDcaAmountChange(event);
      expect(component.dcaAmount()).toBe(1000000);
    });
  });

  describe('formatVnd', () => {
    it('formats large VND values without decimals', () => {
      expect(component.formatVnd(15000)).toBe('15,000');
    });
  });

  describe('formatUnits', () => {
    it('formats units with 4 decimal places', () => {
      expect(component.formatUnits(1.23456789)).toBe('1.2346');
    });
  });

  describe('runSimulation', () => {
    it('calculates unit accumulation correctly', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 10000 },
        { date: '2025-02-01', close: 20000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(1000000);

      component.runSimulation();

      const result = component.dcaResult();
      expect(result).not.toBeNull();
      expect(result!.totalInvested).toBe(2000000);
      expect(result!.totalUnits).toBeCloseTo(100 + 50, 4);
    });

    it('sets dcaError when no prices returned', () => {
      mockService.getDcaPrices.mockReturnValue(of([]));
      component.runSimulation();
      expect(component.dcaError()).toBe('No price data found for the selected date range.');
    });

    it('does not call service when no ETF selected', () => {
      mockService.getDcaPrices.mockClear();
      component.selectedEtf.set(null);
      component.runSimulation();
      expect(mockService.getDcaPrices).not.toHaveBeenCalled();
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
      component.runSimulation();
      error$.error(new Error('network'));
      expect(component.dcaError()).toBe('Failed to fetch price data.');
    });

    it('gainLossPct is ~0 when buy and sell prices equal', () => {
      const prices: PricePoint[] = [
        { date: '2025-01-01', close: 10000 },
        { date: '2025-02-01', close: 10000 },
      ];
      mockService.getDcaPrices.mockReturnValue(of(prices));
      component.dcaAmount.set(1000000);
      component.runSimulation();
      expect(component.dcaResult()!.gainLossPct).toBeCloseTo(0, 1);
    });
  });
});
