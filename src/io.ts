import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import {columns, tables, empty, type Data, type Table} from './model';
export function parseCsv(text:string, table:Table, source:string):Data[Table] {
 if(!text.trim()) throw new Error(`${source}：文件为空`);
 const clean=text.replace(/^\uFEFF/,'');
 const matrix:unknown[][]=[]; const lines:number[]=[]; let cursor=0; let line=1; const errors:string[]=[];
 Papa.parse<string[]>(clean,{step(result){const start=cursor; cursor=result.meta.cursor; const segment=clean.slice(start,cursor); const row=result.data; if(result.errors.length) errors.push(result.errors[0].message); if(row.some(v=>v.trim())) {matrix.push(row);lines.push(line);} line+=(segment.match(/\r\n|\r|\n/g)||[]).length; }});
 if(errors.length) throw new Error(`${source}：CSV 格式错误：${errors[0]}`);
 return rowsFromMatrix(matrix,table,source).map((r,i)=>({...r,line:lines[i+1]}));
}
function rowsFromMatrix(matrix:unknown[][],table:Table,source:string):Data[Table] {
 if(!matrix.length) throw new Error(`${source}：空表`);
 const headers=matrix[0].map(x=>String(x??'').trim());
 if(new Set(headers).size!==headers.length) throw new Error(`${source}：列名重复`);
 const missing=columns[table].filter(c=>!headers.includes(c)); if(missing.length) throw new Error(`${source}：缺少列 ${missing.join(', ')}`);
 return matrix.slice(1).map((row,i)=>({values:Object.fromEntries(columns[table].map(c=>[c,String(row[headers.indexOf(c)]??'').trim()])),line:i+2,source})).filter(r=>Object.values(r.values).some(Boolean));
}
export async function parseXlsx(buffer:ArrayBuffer,source:string):Promise<Data> {
 const wb=new ExcelJS.Workbook(); try {await wb.xlsx.load(buffer);} catch {throw new Error(`${source}：XLSX 格式错误`);}
 const result=empty(); for(const t of tables) {const sheet=wb.getWorksheet(t); if(!sheet) throw new Error(`${source}：缺少工作表 ${t}`); const matrix:unknown[][]=[]; sheet.eachRow({includeEmpty:true},(row,n)=>{matrix[n-1]=Array.from({length:sheet.columnCount},(_,i)=>{const v=row.getCell(i+1).value; if(v && typeof v==='object') throw new Error(`${source}/${t}：请使用文本或数字单元格，不能使用公式或日期单元格`); return v;});}); result[t]=rowsFromMatrix(matrix,t,`${source}/${t}`); } return result;
}
export function csv(rows:unknown[][]):string {return '\uFEFF'+Papa.unparse(rows.map(row=>row.map(v=>{const s=String(v??''); return /^[\s\u0000-\u001f]*[=+@\-\t\r]/.test(s)?`'${s}`:s;})),{newline:'\r\n'});}
export async function workbook(data:Data):Promise<Blob> {const wb=new ExcelJS.Workbook(); for(const t of tables){const s=wb.addWorksheet(t); s.addRow([...columns[t]]); data[t].forEach(r=>s.addRow(columns[t].map(c=>r.values[c]||'')));} const buf=await wb.xlsx.writeBuffer(); return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
export function download(blob:Blob,name:string) {const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
