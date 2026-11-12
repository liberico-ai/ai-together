import { z } from 'zod';
import { invariant } from './errors';

const minute=60_000,day=24*60*minute,vietnamOffset=7*60*minute;
const window=z.object({from:z.number().int().min(0).max(1439),to:z.number().int().min(1).max(1440)}).strict()
  .refine(value=>value.from<value.to);
export const calendarSchema=z.object({
  version:z.string().min(1).max(120),zone:z.literal('Asia/Ho_Chi_Minh'),
  days:z.array(z.object({weekday:z.number().int().min(0).max(6),windows:z.array(window).min(1).max(8)}).strict()).min(1).max(7),
  holidays:z.array(z.iso.date()).max(366),
}).strict().refine(calendar=>new Set(calendar.days.map(row=>row.weekday)).size===calendar.days.length &&
  calendar.days.every(row=>row.windows.every((slot,i)=>i===0||row.windows[i-1].to<=slot.from)));
export type Calendar=z.infer<typeof calendarSchema>;

/** Working intervals in Vietnam civil time. The reporting calendar covers dates from 2000. */
export function workingDueAt(deliveredAt:string,slaMinutes:number,calendar:Calendar) {
  const clock=Date.parse(deliveredAt)+vietnamOffset;
  invariant(Number.isFinite(clock)&&clock>=Date.UTC(2000,0,1)&&Number.isInteger(slaMinutes)&&slaMinutes>0,
    'INVALID_SLA','Lịch và thời hạn phản hồi không hợp lệ.',422);
  const firstDay=Math.floor(clock/day)*day;
  let remaining=slaMinutes*minute;
  const slots=new Map(calendar.days.map(row=>[row.weekday,row.windows]));
  const holidays=new Set(calendar.holidays);
  for(let step=0;step<366;step++){
    const start=firstDay+step*day;
    const date=new Date(start);
    if(holidays.has(date.toISOString().slice(0,10))) continue;
    for(const interval of slots.get(date.getUTCDay())??[]){
      const from=Math.max(clock,start+interval.from*minute),to=start+interval.to*minute;
      if(to<=from) continue;
      if(to-from>=remaining) return new Date(from+remaining-vietnamOffset).toISOString();
      remaining-=to-from;
    }
  }
  invariant(false,'INVALID_SLA','Lịch làm việc không bao phủ được hạn phản hồi.',422);
}
