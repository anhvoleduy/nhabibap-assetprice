import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'gold', pathMatch: 'full' },
  {
    path: 'gold',
    loadChildren: () =>
      import('./features/gold/gold.routes').then(m => m.GOLD_ROUTES),
  },
];
