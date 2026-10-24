import type { Permission } from './permissions';
import { uuidPattern } from './config';

type Field = {key:string; label:string; required?:boolean; type?:'text'|'date'|'email'|'number'|'uuid'; options?:readonly string[]};
type Module = {label:string; table:string; read:Permission; create:Permission; edit:Permission; archive:Permission; fields:Field[]};
export const modules: Record<string,Module> = {
  leads:{label:'Leads',table:'leads',read:'leads.view',create:'leads.create',edit:'leads.edit',archive:'leads.delete',fields:[
    {key:'name',label:'Name',required:true},{key:'company',label:'Company',required:true},{key:'email',label:'Email',type:'email'},
    {key:'phone',label:'Phone'},{key:'stage',label:'Stage',required:true,options:['New','Contacted','Qualified','Meeting','Proposal','Won','Lost']},
    {key:'estimated_value',label:'Estimated value',required:true,type:'number'},{key:'notes',label:'Notes'}]},
  clients:{label:'Clients',table:'clients',read:'clients.view',create:'clients.manage',edit:'clients.manage',archive:'clients.manage',fields:[
    {key:'name',label:'Name',required:true},{key:'company',label:'Company',required:true},{key:'lead_id',label:'Related lead ID',type:'uuid'},{key:'notes',label:'Notes'}]},
  projects:{label:'Projects',table:'projects',read:'projects.view',create:'projects.manage',edit:'projects.manage',archive:'projects.manage',fields:[
    {key:'name',label:'Name',required:true},{key:'client',label:'Client',required:true},{key:'lead_id',label:'Related lead ID',type:'uuid'},
    {key:'status',label:'Status',required:true,options:['Planned','Active','Waiting for client','Review','Completed','On hold']},
    {key:'priority',label:'Priority',required:true,options:['Low','Medium','High']},{key:'due_date',label:'Due date',type:'date'},{key:'notes',label:'Notes'}]},
  tasks:{label:'Tasks',table:'tasks',read:'tasks.view',create:'tasks.manage',edit:'tasks.manage',archive:'tasks.manage',fields:[
    {key:'title',label:'Title',required:true},{key:'due_date',label:'Due date',required:true,type:'date'},{key:'lead_id',label:'Related lead ID',type:'uuid'}]},
  quotes:{label:'Quote drafts',table:'quotes',read:'sales.view',create:'sales.manage',edit:'sales.manage',archive:'sales.manage',fields:[
    {key:'title',label:'Title',required:true},{key:'lead_id',label:'Related lead ID',type:'uuid'},
    {key:'currency',label:'Currency',required:true,options:['INR','USD','EUR','GBP','AED']},{key:'status',label:'Status',required:true,options:['Draft']},{key:'notes',label:'Notes'}]},
  proposals:{label:'Proposal drafts',table:'proposals',read:'sales.view',create:'sales.manage',edit:'sales.manage',archive:'sales.manage',fields:[
    {key:'title',label:'Title',required:true},{key:'lead_id',label:'Related lead ID',type:'uuid'},{key:'scope',label:'Scope'},
    {key:'price',label:'Price',required:true,type:'number'},{key:'currency',label:'Currency',required:true,options:['INR','USD','EUR','GBP','AED']},
    {key:'status',label:'Status',required:true,options:['Draft']}]},
  payments:{label:'Payments',table:'payments',read:'sales.view',create:'sales.manage',edit:'sales.manage',archive:'sales.manage',fields:[
    {key:'title',label:'Title',required:true},{key:'lead_id',label:'Related lead ID',type:'uuid'},{key:'amount',label:'Amount',required:true,type:'number'},
    {key:'currency',label:'Currency',required:true,options:['INR','USD','EUR','GBP','AED']},{key:'due_date',label:'Due date',type:'date'},
    {key:'status',label:'Status',required:true,options:['Due','Paid','Overdue']}]},
};
export function recordModule(key:string):Module {
  if (!Object.hasOwn(modules,key)) throw new Error('Unsupported record type.');
  return modules[key];
}
export function recordValues(key:string,input:Record<string,unknown>) {
  const definition = recordModule(key);
  if (Object.keys(input).some(k => !definition.fields.some(f => f.key === k))) throw new Error('Unsupported field.');
  const result:Record<string,string|number|null> = {};
  for (const field of definition.fields) {
    const raw = input[field.key];
    if (raw !== undefined && raw !== null && typeof raw !== 'string') throw new Error('Invalid field value.');
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) { if (field.required) throw new Error(`${field.label} is required.`); result[field.key] = null; continue; }
    if (value.length > 4000 || (field.options && !field.options.includes(value))) throw new Error(`Invalid ${field.label}.`);
    if (field.type === 'uuid' && !uuidPattern.test(value)) throw new Error('Related record ID must be a UUID.');
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Invalid email.');
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) throw new Error('Invalid date.');
    if (field.type === 'number') {
      if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 999999999999.99) throw new Error('Use a non-negative amount with at most two decimal places.');
      result[field.key] = Number(value);
    } else result[field.key] = value;
  }
  return result;
}
export function pageNumber(input:unknown) { const n = Number(input); return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1; }
