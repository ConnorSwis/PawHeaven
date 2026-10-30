import { useState } from 'react';
import { HELP_REASONS, HELP_REASON_LABELS, type HelpReason, type AdminDonationsResponse, type AdminVisitScheduleResponse, type AdminVolunteerShiftListResponse, type AdminAdoptionApplicationListResponse, type AdminFosterApplicationListResponse, type AdminLostPetInquiryListResponse, type AttentionItem } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { formatMoney, formatTime, shelterDay } from '../lib/format';
import { useRoute } from '../lib/router';
import type { PageProps } from '../routes';
import { Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton, StatCard } from '../ui';
import { CapacityCard, CapacitySheet } from './animals/Capacity';
import { PlusIcon } from '../ui/icons';
import { useToast } from '../ui/toast';

const itemKey = (item: AttentionItem) => `${item.kind}-${item.refId ?? item.title}`;
const actionLabel: Record<AttentionItem['action'], string> = { generate: 'Fill in open hours', schedule: 'Open schedule', open_foster: 'Open to foster', fosters: 'Go to fostering', animals: 'Open animals', mark_help: 'Mark needs help' };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home({ user }: PageProps) {
  const { navigate } = useRoute();
  const toast = useToast();
  const refresh = useRefresh();
  const [working, setWorking] = useState<string | null>(null);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [reason, setReason] = useState<HelpReason>('long_stay');
  const attention = useApi<{ items: AttentionItem[] }>('/admin/attention', { refetchSeconds: 120 });
  const visits = useApi<AdminVisitScheduleResponse>('/admin/visit-slots');
  const shifts = useApi<AdminVolunteerShiftListResponse>('/admin/volunteer-shifts');
  const donations = useApi<AdminDonationsResponse>('/admin/donations');
  const adoption = useApi<AdminAdoptionApplicationListResponse>('/admin/applications');
  const foster = useApi<AdminFosterApplicationListResponse>('/admin/foster-applications');
  const lost = useApi<AdminLostPetInquiryListResponse>('/admin/lost-pet-inquiries');

  const today = shelterDay(Date.now());
  const now = Date.now();
  const week = now + 7 * 86_400_000;
  const waiting = (adoption.data?.applications.filter((item) => item.status === 'Pending').length ?? 0) + (foster.data?.applications.filter((item) => item.status === 'Pending').length ?? 0) + (lost.data?.inquiries.filter((item) => item.status === 'New').length ?? 0);
  const todaysVisits = (visits.data?.slots ?? []).filter((slot) => slot.status === 'published' && slot.appointments.length > 0 && shelterDay(slot.startsAt) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visitCount = todaysVisits.reduce((sum, slot) => sum + slot.appointments.length, 0);
  const todaysShifts = (shifts.data?.shifts ?? []).filter((shift) => shift.status === 'published' && shelterDay(shift.startsAt) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const needPeople = (shifts.data?.shifts ?? []).filter((shift) => shift.status === 'published' && Date.parse(shift.startsAt) > now && Date.parse(shift.startsAt) < week && shift.participants.length < shift.capacity).length;
  const month = today.slice(0, 7);
  const monthGifts = (donations.data?.donations ?? []).filter((gift) => gift.status === 'succeeded' && shelterDay(gift.createdAt).startsWith(month));
  const monthTotal = monthGifts.reduce((sum, gift) => sum + gift.amountCents, 0);

  const run = async (item: AttentionItem) => {
    if (item.action === 'schedule') return navigate('/schedule');
    if (item.action === 'fosters') return navigate('/fostering');
    if (item.action === 'animals') return navigate(item.petIds?.length ? '/animals?help=1' : '/animals');
    if (item.action === 'mark_help') { setReason('long_stay'); setChoosing(itemKey(item)); return; }
    setWorking(item.title);
    try {
      if (item.action === 'generate') { const result = await api<{ visitsCreated: number; shiftsCreated: number }>('/admin/availability/generate', { method: 'POST' }); toast.success(`Added ${result.visitsCreated} visit times and ${result.shiftsCreated} shifts.`); }
      else { await api('/admin/pets/flags', { method: 'POST', json: { petIds: item.petIds ?? [], fosterAvailable: true } }); toast.success('Those animals are now open to foster.'); }
      await refresh('/admin/attention', '/admin/pets', '/admin/visit-slots', '/admin/volunteer-shifts', '/admin/capacity');
    } catch (error) { toast.error(errorMessage(error)); } finally { setWorking(null); }
  };

  const markHelp = async (item: AttentionItem) => {
    setWorking(item.title);
    try {
      await api('/admin/pets/help', { method: 'POST', json: { petIds: item.petIds ?? [], reason } });
      toast.success(`Marked as: ${HELP_REASON_LABELS[reason]}.`);
      setChoosing(null);
      await refresh('/admin/attention', '/admin/pets', '/admin/capacity');
    } catch (error) { toast.error(errorMessage(error)); } finally { setWorking(null); }
  };

  const loadingStats = adoption.isLoading || visits.isLoading || shifts.isLoading || donations.isLoading;
  return (
    <div className="grid gap-6">
      <PageHeader title={`${greeting()}, ${user.name.split(' ')[0] || 'there'}`} description="What is waiting on you, and what is happening today."
        actions={<><Button onClick={() => navigate('/schedule?add=1')}><PlusIcon width={16} height={16} />Add to schedule</Button><Button variant="primary" onClick={() => navigate('/animals?id=new')}><PlusIcon width={16} height={16} />Add animal</Button></>} />

      {loadingStats ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-24" />)}</div> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Requests waiting" value={waiting} hint="Applications and inquiries" onClick={() => navigate('/requests')} />
          <StatCard label="Visits today" value={visitCount} hint={visitCount ? `${todaysVisits.length} time${todaysVisits.length === 1 ? '' : 's'} booked` : 'Nobody booked'} onClick={() => navigate('/schedule')} />
          <StatCard label="Shifts need people" value={needPeople} hint="Next 7 days, not full" onClick={() => navigate('/schedule')} />
          <StatCard label="Donations this month" value={formatMoney(monthTotal)} hint={`${monthGifts.length} gift${monthGifts.length === 1 ? '' : 's'}, test mode included`} onClick={() => navigate('/donations')} />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <h2 className="text-base font-semibold text-stone-950">Needs you</h2>
          {attention.isLoading && <div className="mt-3 grid gap-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
          {attention.isError && <p className="mt-3 text-sm text-red-800" role="alert">{errorMessage(attention.error, 'The list could not be loaded.')}</p>}
          {attention.data && attention.data.items.length === 0 && <EmptyState title="You are all caught up">Nothing needs attention right now.</EmptyState>}
          {attention.data && attention.data.items.length > 0 && (
            <ul className="mt-3 divide-y divide-stone-200">
              {attention.data.items.slice(0, 7).map((item, index) => (
                <li key={`${item.kind}-${item.refId ?? index}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-stone-950">{item.title}</p><p className="text-xs leading-5 text-stone-600">{item.detail}</p></div>
                  {item.action === 'mark_help' && choosing === itemKey(item) ? (
                    <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label={`Why does this need help? ${item.title}`}>
                      <Select aria-label="Reason" autoFocus value={reason} onChange={(event) => setReason(event.target.value as HelpReason)} className="min-h-11 w-auto! flex-1 sm:max-w-xs">{HELP_REASONS.map((value) => <option key={value} value={value}>{HELP_REASON_LABELS[value]}</option>)}</Select>
                      <Button size="sm" variant="primary" className="min-h-11" disabled={working === item.title} onClick={() => void markHelp(item)}>{working === item.title ? 'Working…' : 'Mark'}</Button>
                      <Button size="sm" variant="ghost" className="min-h-11" disabled={working === item.title} onClick={() => setChoosing(null)}>Cancel</Button>
                    </div>
                  ) : <Button size="sm" className="min-h-11" disabled={working === item.title} onClick={() => void run(item)}>{working === item.title ? 'Working…' : actionLabel[item.action]}</Button>}
                </li>
              ))}
              {attention.data.items.length > 7 && <li className="pt-3 text-xs text-stone-600">And {attention.data.items.length - 7} more.</li>}
            </ul>
          )}
        </Card>

        <div className="grid gap-6">
        <CapacityCard showEdit onEdit={() => setCapacityOpen(true)} onHelp={() => navigate('/animals?help=1')} />
        <Card>
          <h2 className="text-base font-semibold text-stone-950">Today</h2>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-600">Visits</h3>
          {visits.isLoading ? <Skeleton className="mt-2 h-12" /> : todaysVisits.length === 0 ? <p className="mt-1 text-sm text-stone-700">No visits are booked today.</p> : (
            <ul className="mt-1 divide-y divide-stone-200">
              {todaysVisits.flatMap((slot) => slot.appointments.map((appointment) => (
                <li key={appointment.id} className="py-2 text-sm">
                  <span className="font-medium text-stone-950">{formatTime(slot.startsAt)}</span> · {appointment.memberName}<span className="text-stone-600"> · party of {appointment.partySize}</span>
                  {appointment.pets.length > 0 && <span className="block text-xs text-stone-600">Meeting {appointment.pets.map((pet) => pet.name).join(', ')}</span>}
                </li>
              )))}
            </ul>
          )}
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-600">Volunteer shifts</h3>
          {shifts.isLoading ? <Skeleton className="mt-2 h-12" /> : todaysShifts.length === 0 ? <p className="mt-1 text-sm text-stone-700">No shifts today.</p> : (
            <ul className="mt-1 divide-y divide-stone-200">
              {todaysShifts.map((shift) => (
                <li key={shift.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-medium text-stone-950">{formatTime(shift.startsAt)}</span> · {shift.title}</span>
                  <Badge tone={shift.participants.length === 0 ? 'warn' : shift.participants.length >= shift.capacity ? 'good' : 'neutral'}>{shift.participants.length}/{shift.capacity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>
      </div>
      <CapacitySheet open={capacityOpen} onOpenChange={setCapacityOpen} />
    </div>
  );
}
