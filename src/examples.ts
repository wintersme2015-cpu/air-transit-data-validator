import {type Data,type Table,empty} from './model';
const make=(t:Table,values:Record<string,string>,line:number)=>({values,line,source:`虚构示例/${t}`});
export function example(kind:'pass'|'mixed'|'edge'):Data {
 const d=empty(); const flight=(id:string,dep:string,arr:string,start:string,end:string)=>make('flights',{flight_id:id,carrier:'ZZ',flight_number:id,departure_airport:dep,arrival_airport:arr,scheduled_departure:start,scheduled_arrival:end},d.flights.length+2);
 d.flights=[flight('F101','AAA','BBB','2026-04-01T20:00:00+08:00','2026-04-01T22:00:00+08:00'),flight('F202','BBB','CCC','2026-04-02T01:00:00+08:00','2026-04-02T05:00:00+08:00')]; d.flights[1].line=3;
 d.passengers=[make('passengers',{passenger_id:'FICTIONAL_P001',inbound_flight_id:'F101',outbound_flight_id:'F202'},2)]; d.baggage=[make('baggage',{baggage_id:'B001',passenger_id:'FICTIONAL_P001',inbound_flight_id:'F101',outbound_flight_id:'F202',weight_kg:'20'},2),make('baggage',{baggage_id:'B002',passenger_id:'FICTIONAL_P001',inbound_flight_id:'F101',outbound_flight_id:'F202',weight_kg:'15'},3)];
 if(kind==='mixed'){d.flights[1].values.departure_airport='DDD';d.baggage[0].values.weight_kg='40';d.baggage[1].values.outbound_flight_id='MISSING';}
 if(kind==='edge'){d.flights[1].values.scheduled_departure='2026-04-01T18:00:00+00:00';d.flights[1].values.scheduled_arrival='2026-04-01T22:00:00+00:00';}
 return d;
}
