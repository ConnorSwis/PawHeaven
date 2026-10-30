import { Providers } from '../../lib/providers';
import { StatusBanner } from './StatusBanner';

/** The banner as its own island, for Astro pages (Foster, Volunteer) that are not one big React component. */
export default function StatusBannerIsland({ className }: { className?: string }) {
  return <Providers><StatusBanner className={className} /></Providers>;
}
