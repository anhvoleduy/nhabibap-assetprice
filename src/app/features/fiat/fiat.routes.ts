import { Routes } from '@angular/router';

export const FIAT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./fiat-page/fiat-page.component').then(m => m.FiatPageComponent),
  },
];
