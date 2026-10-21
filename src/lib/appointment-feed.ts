type Appointment = {status:string;startsAt:string;endsAt:string};
export function upcomingAppointments<T extends Appointment>(bookings:T[], now=Date.now()):T[] {
 return bookings.filter(booking=>['PENDING','CONFIRMED','CHECKED_IN'].includes(booking.status)&&Number.isFinite(Date.parse(booking.startsAt))&&Date.parse(booking.endsAt)>now)
  .sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
}
export function appointmentDayKey(value:string) {
 const date=new Date(value);
 return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}
export function appointmentDayLabel(value:string, now=Date.now()) {
 const date=new Date(value),today=new Date(now),tomorrow=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
 const prefix=appointmentDayKey(value)===appointmentDayKey(today.toISOString())?'Today':appointmentDayKey(value)===appointmentDayKey(tomorrow.toISOString())?'Tomorrow':null;
 const label=date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
 return prefix?`${prefix} · ${label}`:label;
}
