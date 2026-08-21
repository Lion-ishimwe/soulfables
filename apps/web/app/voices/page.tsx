import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Reader Voices' };

/* Voices live inside Residents; keep the old path working. */
export default function VoicesPage() {
  redirect('/residents');
}
