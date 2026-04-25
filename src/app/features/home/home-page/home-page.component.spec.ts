import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let component: HomePageComponent;
  let fixture: ComponentFixture<HomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has 4 asset cards', () => {
    expect(component.assets.length).toBe(4);
  });

  it('includes gold card with correct route', () => {
    const gold = component.assets.find(a => a.id === 'gold');
    expect(gold).toBeTruthy();
    expect(gold!.route).toBe('/gold');
  });

  it('includes bitcoin card with correct route', () => {
    const btc = component.assets.find(a => a.id === 'bitcoin');
    expect(btc).toBeTruthy();
    expect(btc!.route).toBe('/bitcoin');
  });

  it('includes fiat card with correct route', () => {
    const fiat = component.assets.find(a => a.id === 'fiat');
    expect(fiat).toBeTruthy();
    expect(fiat!.route).toBe('/fiat');
  });

  it('includes etf card with correct route', () => {
    const etf = component.assets.find(a => a.id === 'etf');
    expect(etf).toBeTruthy();
    expect(etf!.route).toBe('/etf');
  });

  it('each asset card has required fields', () => {
    component.assets.forEach(asset => {
      expect(asset.id).toBeTruthy();
      expect(asset.icon).toBeTruthy();
      expect(asset.name).toBeTruthy();
      expect(asset.description).toBeTruthy();
      expect(asset.route).toBeTruthy();
      expect(asset.accentColor).toBeTruthy();
      expect(asset.bgColor).toBeTruthy();
    });
  });
});
