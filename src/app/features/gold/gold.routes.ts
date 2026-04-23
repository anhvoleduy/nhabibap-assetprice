import { Routes } from '@angular/router';

export const GOLD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./gold-page/gold-page.component').then(m => m.GoldPageComponent),
  },
];
