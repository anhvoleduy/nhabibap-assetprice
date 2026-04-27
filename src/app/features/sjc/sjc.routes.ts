import { Routes } from '@angular/router';

export const SJC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sjc-page/sjc-page.component').then(m => m.SjcPageComponent),
  },
];
