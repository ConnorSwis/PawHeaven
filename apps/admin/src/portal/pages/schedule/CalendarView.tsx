import { Calendar, type EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useEffect, useRef, type RefObject } from 'react';
import type { AdminVisitSlot, AdminVolunteerShift } from '@pawheaven/contracts';
import { fromWall, wall } from './time';
import './calendar.css';

export type CalendarHandle = { currentDate: () => string; next: () => void };
export type Selection = { date: string; start: string; end: string };

/** Back-to-back visit times from the same pattern or event read as one block. */
export function groupSlots(slots: AdminVisitSlot[]): AdminVisitSlot[][] {
  const sorted = [...slots].sort((x, y) => Date.parse(x.startsAt) - Date.parse(y.startsAt));
  const groups: AdminVisitSlot[][] = [];
  for (const slot of sorted) {
    const last = groups[groups.length - 1];
    if (last && last[last.length - 1].endsAt === slot.startsAt && last[0].eventId === slot.eventId) last.push(slot); else groups.push([slot]);
  }
  return groups;
}

function buildEvents(slots: AdminVisitSlot[], shifts: AdminVolunteerShift[], exceptions: { date: string; reason: string }[]): EventInput[] {
  const out: EventInput[] = [];
  for (const group of groupSlots(slots)) {
    const booked = group.reduce((sum, slot) => sum + slot.appointments.length, 0);
    const capacity = group.reduce((sum, slot) => sum + slot.capacity, 0);
    out.push({
      id: `visit-${group[0].id}`, title: `Visits · ${booked}/${capacity} booked`, start: wall(group[0].startsAt), end: wall(group[group.length - 1].endsAt),
      classNames: ['ev-visit', ...(group[0].eventId ? ['ev-event'] : []), ...(booked >= capacity ? ['ev-full'] : [])], extendedProps: { kind: 'visit', ids: group.map((slot) => slot.id) },
    });
  }
  for (const shift of shifts) {
    out.push({
      id: `shift-${shift.id}`, title: `${shift.title} · ${shift.participants.length}/${shift.capacity}`, start: wall(shift.startsAt), end: wall(shift.endsAt),
      classNames: ['ev-shift', ...(shift.participants.length === 0 ? ['ev-empty'] : []), ...(shift.participants.length >= shift.capacity ? ['ev-full'] : [])], extendedProps: { kind: 'shift', id: shift.id },
    });
  }
  for (const exception of exceptions) out.push({ start: exception.date, allDay: true, display: 'background', classNames: ['ev-closed'], title: exception.reason || 'Closed' });
  return out;
}

/**
 * FullCalendar in UTC mode, fed the shelter's wall-clock times, so every label reads in America/New_York
 * whatever the browser's zone is. Selections convert back the same way.
 */
export function CalendarView({ slots, shifts, exceptions, visible, handle, onSelect, onVisit, onShift }: {
  slots: AdminVisitSlot[]; shifts: AdminVolunteerShift[]; exceptions: { date: string; reason: string }[]; visible: boolean;
  handle: RefObject<CalendarHandle | null>;
  onSelect: (selection: Selection) => void; onVisit: (slotIds: string[]) => void; onShift: (shiftId: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const calendar = useRef<Calendar | null>(null);
  const callbacks = useRef({ onSelect, onVisit, onShift });
  callbacks.current = { onSelect, onVisit, onShift };

  useEffect(() => {
    if (!mount.current) return;
    const instance = new Calendar(mount.current, {
      plugins: [timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin],
      timeZone: 'UTC',
      now: () => wall(new Date().toISOString()),
      initialView: mount.current.clientWidth > 0 && mount.current.clientWidth < 520 ? 'listWeek' : 'timeGridWeek',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek' },
      buttonText: { today: 'Today', week: 'Week', day: 'Day', month: 'Month', listWeek: 'List' },
      slotMinTime: '07:00:00', slotMaxTime: '21:00:00', slotDuration: '00:30:00', snapDuration: '00:30:00',
      expandRows: true, height: 'auto', slotEventOverlap: false, eventMinHeight: 24, slotLabelInterval: '01:00', nowIndicator: true, allDaySlot: false, navLinks: true, dayMaxEvents: 4, eventMaxStack: 3,
      selectable: true, selectMirror: true, selectMinDistance: 3,
      eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' },
      select: (info) => {
        const month = info.view.type === 'dayGridMonth';
        const start = fromWall(info.start);
        callbacks.current.onSelect({ date: start.slice(0, 10), start: month ? '10:00' : start.slice(11), end: month ? '12:00' : fromWall(info.end).slice(11) });
        instance.unselect();
      },
      eventClick: (info) => {
        const props = info.event.extendedProps as { kind?: string; ids?: string[]; id?: string };
        if (props.kind === 'visit' && props.ids) callbacks.current.onVisit(props.ids);
        else if (props.kind === 'shift' && props.id) callbacks.current.onShift(props.id);
      },
      eventDidMount: (info) => { info.el.title = info.event.title; },
    });
    instance.render();
    calendar.current = instance;
    handle.current = { currentDate: () => fromWall(instance.getDate()).slice(0, 10), next: () => instance.next() };
    return () => { instance.destroy(); calendar.current = null; handle.current = null; };
  }, [handle]);

  useEffect(() => {
    const instance = calendar.current;
    if (!instance) return;
    instance.removeAllEvents();
    instance.addEventSource(buildEvents(slots, shifts, exceptions));
  }, [slots, shifts, exceptions]);

  useEffect(() => { if (visible) calendar.current?.updateSize(); }, [visible]);

  return <div ref={mount} data-sched-calendar className="sched-cal" />;
}
