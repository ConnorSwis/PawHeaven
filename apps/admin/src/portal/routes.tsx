import type { ComponentType } from 'react';
import type { AdminUser } from '@pawheaven/contracts';
import Animals from './pages/Animals';
import Donations from './pages/Donations';
import Fostering from './pages/Fostering';
import Home from './pages/Home';
import People from './pages/People';
import Requests from './pages/Requests';
import Schedule from './pages/Schedule';

export type PageProps = { user: AdminUser };
export const routes: { path: string; component: ComponentType<PageProps> }[] = [
  { path: '/', component: Home },
  { path: '/animals', component: Animals },
  { path: '/requests', component: Requests },
  { path: '/schedule', component: Schedule },
  { path: '/fostering', component: Fostering },
  { path: '/donations', component: Donations },
  { path: '/people', component: People },
];
