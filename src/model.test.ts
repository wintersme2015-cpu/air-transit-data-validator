import {describe,it,expect} from 'vitest';
import {validate,parseTime,columns} from './model';
import {example} from './examples';
import {parseCsv,csv,parseXlsx,workbook} from './io';
import ExcelJS from 'exceljs';
const ids=(d=example('pass'))=>validate(d).map(x=>x.rule);
describe('validation',()=>{
 it('accepts valid and timezone boundary data, including two bags for one passenger',()=>{expect(ids()).toEqual([]);expect(ids(example('edge'))).toEqual([]);});
 it('reports the documented mixed sample',()=>expect(ids(example('mixed')).sort()).toEqual(['R07','R09','R11','R13']));
 it('checks required, format, time and flight order',()=>{const d=example('pass');d.flights[0].values.carrier='';d.flights[0].values.departure_airport='aa';d.flights[0].values.scheduled_departure='2026-02-30T10:00:00Z';expect(ids(d)).toEqual(expect.arrayContaining(['R01','R02','R03']));d.flights[0].values.scheduled_departure='2026-04-02T10:00:00Z';expect(ids(d)).toContain('R04');});
 it('suppresses ambiguous downstream checks for duplicate flights',()=>{const d=example('pass');d.flights.push({...d.flights[0],line:4});const got=ids(d);expect(got).toContain('R05');expect(got).toContain('R06');expect(got).toContain('R07');expect(got).not.toContain('R09');expect(got).not.toContain('R10');});
 it('checks references, same flight, ordering and baggage consistency',()=>{const d=example('pass');d.passengers[0].values.outbound_flight_id='F101';d.baggage[0].values.passenger_id='NONE';expect(ids(d)).toEqual(expect.arrayContaining(['R08','R07','R11']));d.passengers[0].values.outbound_flight_id='F202';d.flights[1].values.scheduled_departure='2026-04-01T21:00:00+08:00';expect(ids(d)).toContain('R10');});
 it('checks weight and connection limits without cascade from missing references',()=>{const d=example('pass');d.baggage[0].values.weight_kg='0';d.baggage[1].values.weight_kg='33';d.flights[1].values.scheduled_departure='2026-04-01T22:30:00+08:00';expect(ids(d)).toEqual(expect.arrayContaining(['R12','R13','R14']));d.passengers[0].values.inbound_flight_id='';const got=ids(d);expect(got).toContain('R01');expect(got).not.toContain('R06');expect(got).not.toContain('R14');});
 it('rejects missing offsets and invalid calendar dates',()=>{expect(parseTime('2026-04-01T10:00:00')).toBeNull();expect(parseTime('2026-02-30T10:00:00Z')).toBeNull();expect(parseTime('2026-04-01T10:00:00+08:00')).toBe(Date.parse('2026-04-01T02:00:00Z'));});
});
describe('parsing and export',()=>{it('rejects empty, missing columns and malformed CSV',()=>{expect(()=>parseCsv('','passengers','x')).toThrow();expect(()=>parseCsv('a,b\n1,2','passengers','x')).toThrow();expect(()=>parseCsv('passenger_id,inbound_flight_id,outbound_flight_id\n"broken','passengers','x')).toThrow();});it('escapes CSV formula text and quotes',()=>{const result=csv([['=1+1','中文,换行\n内容']]);expect(result).toContain("'=1+1");expect(result).toContain('"中文,换行\n内容"');});it('roundtrips XLSX and rejects invalid workbook',async()=>{const b=await workbook(example('pass'));const d=await parseXlsx(await b.arrayBuffer(),'test.xlsx');expect(validate(d)).toEqual([]);await expect(parseXlsx(new ArrayBuffer(2),'bad.xlsx')).rejects.toThrow();});});

describe('additional boundaries',()=>{
 it('preserves original CSV row positions across blank and multiline records',()=>{const rows=parseCsv('passenger_id,inbound_flight_id,outbound_flight_id\n\n"FICTIONAL\nP1",F1,F2\nP2,F1,F2','passengers','x');expect(rows.map(r=>r.line)).toEqual([3,5]);});
 it('rejects missing XLSX sheets and missing columns',async()=>{const wb=new ExcelJS.Workbook();wb.addWorksheet('flights').addRow([...columns.flights]);const bytes=await wb.xlsx.writeBuffer();await expect(parseXlsx(bytes as ArrayBuffer,'missing.xlsx')).rejects.toThrow();});
 it('distinguishes duplicate passenger and baggage keys',()=>{const d=example('pass');d.passengers.push({...d.passengers[0],line:3});d.baggage[1].values.baggage_id='B001';const issues=validate(d);expect(issues.filter(i=>i.rule==='R05')).toHaveLength(4);expect(issues.filter(i=>i.rule==='R07'&&i.field==='passenger_id')).toHaveLength(2);expect(issues.some(i=>i.rule==='R11')).toBe(false);});
 it('reports long connections and rejects invalid weight without review',()=>{const d=example('pass');d.flights[1].values.scheduled_departure='2026-04-04T01:00:00+08:00';d.baggage[0].values.weight_kg='NaN';const got=ids(d);expect(got).toContain('R14');expect(got).toContain('R12');expect(got).not.toContain('R13');});
});
