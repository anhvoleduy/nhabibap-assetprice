import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/home/home.routes').then(m => m.HOME_ROUTES),
  },
  {
    path: 'gold',
    loadChildren: () =>
      import('./features/gold/gold.routes').then(m => m.GOLD_ROUTES),
  },
  {
    path: 'bitcoin',
    loadChildren: () =>
      import('./features/bitcoin/bitcoin.routes').then(m => m.BITCOIN_ROUTES),
  },
  {
    path: 'fiat',
    loadChildren: () =>
      import('./features/fiat/fiat.routes').then(m => m.FIAT_ROUTES),
  },
  {
    path: 'etf',
    loadChildren: () =>
      import('./features/etf/etf.routes').then(m => m.ETF_ROUTES),
  },
  {
    path: 'sjc',
    loadChildren: () =>
      import('./features/sjc/sjc.routes').then(m => m.SJC_ROUTES),
  },
];
