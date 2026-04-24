import { Routes } from '@angular/router';

export const BITCOIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./bitcoin-page/bitcoin-page.component').then(m => m.BitcoinPageComponent),
  },
];
