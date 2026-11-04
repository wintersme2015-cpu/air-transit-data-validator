export const columns = {
 flights: ['flight_id','carrier','flight_number','departure_airport','arrival_airport','scheduled_departure','scheduled_arrival'],
 passengers: ['passenger_id','inbound_flight_id','outbound_flight_id'],
 baggage: ['baggage_id','passenger_id','inbound_flight_id','outbound_flight_id','weight_kg'],
} as const;
export type Table = keyof typeof columns;
export type Row = { values: Record<string,string>; line: number; source: string };
export type Data = Record<Table, Row[]>;
export const tables = Object.keys(columns) as Table[];
export const empty = (): Data => ({flights:[],passengers:[],baggage:[]});
export type Issue = { rule:string; severity:'错误'|'人工复核'; table:Table; source:string; line:number; record:string; field:string; value:string; message:string; advice:string; related:string };
export const rules: Record<string,[string,Issue['severity'],string,string]> = {
 R01:['必填字段缺失','错误','字段为空','填写字段'], R02:['字段格式不合法','错误','标识或代码格式不合法','按数据字典修正'], R03:['时间格式不合法','错误','时间无效或缺少 UTC 偏移','填写带偏移的 ISO 8601 时间'], R04:['航班时间顺序错误','错误','到达不晚于出发','核对航班时间'], R05:['主键重复','错误','主键出现多次，关联无法唯一确定','为每条记录指定唯一主键'], R06:['旅客航班引用无效','错误','航班不存在或主键重复导致关联不明确','核对航班实例 ID 并消除重复'], R07:['行李引用无效','错误','旅客或航班不存在，或主键重复导致关联不明确','核对引用并消除重复'], R08:['两航段相同','错误','入境与后续航班相同','核对航段'], R09:['中转机场不一致','错误','前序到达机场与后续出发机场不同','核对机场和航段'], R10:['中转时间顺序错误','错误','后续起飞不晚于前序到达','核对航班时间'], R11:['行李航段不一致','错误','行李航段与所属旅客不一致','核对行李与旅客航段'], R12:['行李重量无效','错误','重量不是有效正数','填写大于零的数字'], R13:['行李重量待复核','人工复核','重量超过演示阈值','人工核对重量'], R14:['中转间隔待复核','人工复核','中转间隔超出演示阈值','人工核对中转安排'],
};
export function parseTime(s:string): number | null {
 const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
 if (!m) return null;
 const [,y,mo,d,h,mi,sec='0',tz]=m; const date=new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,+sec));
 if (+y<100 || date.getUTCFullYear()!==+y || date.getUTCMonth()!==+mo-1 || date.getUTCDate()!==+d || +h>23 || +mi>59 || +sec>59 || (tz!=='Z' && (+tz.slice(1,3)>23 || +tz.slice(4)>59))) return null;
 const n=Date.parse(s); return Number.isFinite(n)?n:null;
}
export function validate(data:Data, limits={weight:32,min:60,max:1440}):Issue[] {
 const out:Issue[]=[];
 const add=(rule:string,t:Table,r:Row,field:string,related='',detail='')=>{const [name,severity,why,advice]=rules[rule]; out.push({rule,severity,table:t,source:r.source,line:r.line,record:r.values[columns[t][0]]||'（无标识）',field,value:r.values[field]||'',message:`${name}：${detail||why}`,advice,related});};
 const indexes = Object.fromEntries(tables.map(t=>{const map=new Map<string,Row[]>(); for(const r of data[t]) {const id=r.values[columns[t][0]]; if(id) map.set(id,[...(map.get(id)||[]),r]);} return [t,map];})) as Record<Table,Map<string,Row[]>>;
 const lookup=(t:Table,id:string)=>indexes[t].get(id)||[];
 for(const t of tables) for(const r of data[t]) {
  const v=r.values;
  for(const field of columns[t]) {
   const s=v[field]||'';
   if(!s) {add('R01',t,r,field); continue;}
   if(field==='weight_kg') {if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)||!Number.isFinite(Number(s))||Number(s)<=0) add('R12',t,r,field); else if(Number(s)>limits.weight) add('R13',t,r,field);}
   else if(field.startsWith('scheduled_')) {if(parseTime(s)===null) add('R03',t,r,field);}
   else if(field.endsWith('_airport')) {if(!/^[A-Z]{3}$/.test(s)) add('R02',t,r,field);}
   else if(field==='carrier') {if(!/^[A-Z0-9]{2,3}$/.test(s)) add('R02',t,r,field);}
   else if(!/^[A-Za-z0-9_-]+$/.test(s)) add('R02',t,r,field);
  }
  const id=v[columns[t][0]]; if(id && lookup(t,id).length>1) add('R05',t,r,columns[t][0],lookup(t,id).map(x=>`${x.source}:${x.line}`).join('; '));
  if(t==='flights') {const a=parseTime(v.scheduled_departure||''),b=parseTime(v.scheduled_arrival||''); if(a!==null&&b!==null&&b<=a) add('R04',t,r,'scheduled_arrival'); continue;}
  for(const field of ['inbound_flight_id','outbound_flight_id']) if(v[field] && lookup('flights',v[field]).length!==1) add(t==='passengers'?'R06':'R07',t,r,field,lookup('flights',v[field]).map(x=>`${x.source}:${x.line}`).join('; '));
  if(t==='baggage' && v.passenger_id) {const matches=lookup('passengers',v.passenger_id); if(matches.length!==1) add('R07',t,r,'passenger_id',matches.map(x=>`${x.source}:${x.line}`).join('; ')); else for(const f of ['inbound_flight_id','outbound_flight_id']) if(v[f] && matches[0].values[f] && v[f]!==matches[0].values[f]) add('R11',t,r,f,`${matches[0].source}:${matches[0].line}`);}
  if(t==='passengers' && v.inbound_flight_id && v.outbound_flight_id) {
   if(v.inbound_flight_id===v.outbound_flight_id) {add('R08',t,r,'outbound_flight_id'); continue;}
   const a=lookup('flights',v.inbound_flight_id),b=lookup('flights',v.outbound_flight_id); if(a.length!==1||b.length!==1) continue;
   const av=a[0].values,bv=b[0].values,rel=`${a[0].source}:${a[0].line}; ${b[0].source}:${b[0].line}`;
   if(/^[A-Z]{3}$/.test(av.arrival_airport||'')&&/^[A-Z]{3}$/.test(bv.departure_airport||'')&&av.arrival_airport!==bv.departure_airport) add('R09',t,r,'outbound_flight_id',rel);
   const arrival=parseTime(av.scheduled_arrival||''),departure=parseTime(bv.scheduled_departure||''); if(arrival!==null&&departure!==null) {const gap=(departure-arrival)/60000; if(gap<=0) add('R10',t,r,'outbound_flight_id',rel); else if(gap<limits.min||gap>limits.max) add('R14',t,r,'outbound_flight_id',rel,`中转间隔 ${gap} 分钟超出演示阈值`);}
  }
 }
 return out;
}
