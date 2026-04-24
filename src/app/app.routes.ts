import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'gold', pathMatch: 'full' },
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
];
