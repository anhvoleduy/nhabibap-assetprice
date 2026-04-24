import { Routes } from '@angular/router';

export const ETF_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./etf-page/etf-page.component').then(m => m.EtfPageComponent),
  },
];
