import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AssetCard {
  id: string;
  icon: string;
  name: string;
  description: string;
  route: string;
  accentColor: string;
  bgColor: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly assets: AssetCard[] = [
    {
      id: 'gold',
      icon: '✦',
      name: 'Gold',
      description: 'Track spot price history and simulate dollar-cost averaging into physical gold.',
      route: '/gold',
      accentColor: '#d97706',
      bgColor: '#fffbeb',
    },
    {
      id: 'bitcoin',
      icon: '₿',
      name: 'Bitcoin',
      description: 'Follow BTC price movements and model recurring investment strategies over time.',
      route: '/bitcoin',
      accentColor: '#f97316',
      bgColor: '#fff7ed',
    },
    {
      id: 'fiat',
      icon: '$',
      name: 'Fiat Currency',
      description: 'Compare exchange rates across major world currencies with live market data.',
      route: '/fiat',
      accentColor: '#3b82f6',
      bgColor: '#eff6ff',
    },
  ];
}
