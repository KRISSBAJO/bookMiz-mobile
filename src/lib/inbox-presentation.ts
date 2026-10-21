import type { InboxNotification } from './api/types';
export function inboxPresentation(item:InboxNotification) {
 const event=(item.eventKey??'').toLowerCase(),meta=item.metadata??{};
 const payment=/payment|refund|payout/.test(event),message=/message|conversation/.test(event),booking=/booking|appointment/.test(event);
 const kind=payment?'Payment':message?'Message':booking?'Booking':/quote|request|match/.test(event)?'Request':'Account';
 const icon=payment?'wallet':message?'comment-dots':booking?/reschedul/.test(event)?'calendar-days':/cancel/.test(event)?'calendar-xmark':'calendar-check':kind==='Request'?'file-lines':'bell';
 const tint=payment?'#f0eaff':message?'#e8f0ff':booking?/cancel/.test(event)?'#fff0ed':'#eaf5ee':'#f1f4f8';
 const color=payment?'#6b4ab0':message?'#3569c8':booking?/cancel/.test(event)?'#b35742':'#26714d':'#52647b';
 const status=(typeof meta.bookingStatus==='string'?meta.bookingStatus:'').toLowerCase();
 const signal=`${event} ${status} ${item.title.toLowerCase()}`;
 const title=booking&&!payment ? /reschedul/.test(signal)?'Appointment rescheduled':/cancel/.test(signal)?'Appointment cancelled':/\bconfirmed\b/.test(signal)?'Appointment confirmed':/completed/.test(signal)?'Appointment completed':/pending|appointment request|appointment.request/.test(signal)?'Appointment request received':item.title : item.title;
 const inferredBusiness=item.title.match(/^(.+?) (?:confirmed your appointment|received your appointment request)/i)?.[1];
 const source=typeof meta.businessName==='string'?meta.businessName:inferredBusiness;
 let preview=typeof meta.preview==='string'?meta.preview:item.body;
 // Legacy booking rows contain the email heading and greeting. Only the list
 // preview is shortened; the complete original stays available in details.
 if(booking&&!message&&typeof meta.preview!=='string') preview=preview.replace(/^.{0,180}?\bHi\s+[^,]{1,100},\s*/i,'');
 return {kind,icon,tint,color,title,source,preview:preview.replace(/\s+/g,' ').trim()};
}
export function inboxDay(value:string,now=Date.now()) {
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'Earlier';
 const today=new Date(now),yesterday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1);
 if(date.toDateString()===today.toDateString())return 'Today';
 if(date.toDateString()===yesterday.toDateString())return 'Yesterday';
 return date.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
}
