import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoProvider } from '../src/lib/provider';
import { applyImport, undoImport } from '../src/lib/crm-operations';
import { seed } from '../src/lib/seed';
import { newLead } from '../src/lib/crm';
import { validateRows, suggestMapping, type ImportRequest } from '../src/lib/lead-import';
import type { Database } from '../src/lib/domain';
import type { Quote } from '../src/lib/business';

function request(): ImportRequest {
  const parsed = {headers:['Name','Email'], rows:[['Undo Fixture','undo@example.com']],sheetName:'CSV',formulaRows:[]};
  return {filename:'undo.csv',rows:validateRows(parsed,suggestMapping(parsed.headers),[]),strategy:'separate',choices:{},targets:{},validOnly:true,confirmed:true};
}
const base = () => ({id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const quote = (leadId:string): Quote => ({...base(),leadId,title:'Related quote',items:[{description:'Design',quantity:1,price:100}],discount:0,tax:0,currency:'INR',notes:'',validUntil:'2026-12-31',status:'Draft'});

test('import → create quote through provider → undo preserves both lead and quote', async () => {
  const provider = new DemoProvider();
  const report = await provider.importLeads(request());
  const leadId = report.rows[0].leadId;
  const record = quote(leadId);
  await provider.save('quotes',record);
  await provider.undoLeadImport(report.id);
  const data = await provider.load();
  assert.ok(data.leads.some(l=>l.id===leadId));
  assert.deepEqual(data.quotes.find(q=>q.id===record.id),record);
  const result=data.imports.find(i=>i.id===report.id)!;
  assert.deepEqual(result.undoSummary,{deleted:0,preserved:1,skipped:0,failed:0});
  assert.match(result.rows[0].undoMessage!,/quotes/);
});

const references: Record<string,(data:Database,id:string)=>void> = {
  clients: (d,id)=>d.clients.push({...base(),leadId:id,name:'Client',company:'Example',notes:''}),
  proposals: (d,id)=>d.proposals.push({...base(),leadId:id,title:'Proposal',quoteId:'',scope:'Design',deliverables:'Website',timeline:'One month',revisions:'One',price:100,currency:'INR',validUntil:'2026-12-31',status:'Draft',sentAt:'',decisionAt:'',followUpAt:'',projectId:''}),
  payments: (d,id)=>d.payments.push({...base(),leadId:id,title:'Payment',amount:100,currency:'INR',dueDate:'2026-12-31',status:'Due',notes:''}),
  projects: (d,id)=>d.projects.push({...d.projects[0],...base(),leadId:id}),
  audits: (d,id)=>d.audits.push({...d.audits[0],...base(),leadId:id}),
  tasks: (d,id)=>d.tasks.push({...base(),leadId:id,title:'Call',auditId:'',dueDate:'2026-12-31',done:false}),
  'legacy note': (d,id)=>d.activities.push({...base(),leadId:id,kind:'Note',description:'Keep this note'}),
  'legacy activity': (d,id)=>d.activities.push({...base(),leadId:id,kind:'Activity',description:'Keep this activity'}),
  'timeline note': (d,id)=>d.leadActivities.push({...base(),leadId:id,type:'Note added',description:'Keep note',actor:'Demo owner'}),
  'email communication': (d,id)=>d.leadActivities.push({...base(),leadId:id,type:'Email logged',description:'Manual log',actor:'Demo owner'}),
  'call communication': (d,id)=>d.leadActivities.push({...base(),leadId:id,type:'Call logged',description:'Manual log',actor:'Demo owner'}),
  'WhatsApp communication': (d,id)=>d.leadActivities.push({...base(),leadId:id,type:'WhatsApp logged',description:'Manual log',actor:'Demo owner'}),
  'follow-up': (d,id)=>d.followUps.push({...base(),leadId:id,title:'Later work',dueAt:'2026-12-31T09:00:00Z',type:'Call',priority:'High',completedAt:'',reminderStatus:'In dashboard'}),
};
for (const [kind,addReference] of Object.entries(references)) {
  test(`undo preserves a lead referenced by ${kind}`, () => {
    const data=seed(); const report=applyImport(data,request()); const id=report.rows[0].leadId;
    addReference(data,id);
    const before=structuredClone(data);
    undoImport(data,report.id);
    assert.ok(data.leads.some(l=>l.id===id));
    assert.equal(report.undoSummary?.preserved,1);
    for(const key of ['leads','clients','quotes','proposals','payments','projects','audits','tasks','activities','leadActivities','followUps'] as const) assert.deepEqual(data[key],before[key]);
  });
}
test('unreferenced unchanged import removes only its creations and retains audit history', () => {
  const data=seed(); const before=structuredClone(data);
  const report=applyImport(data,request()); const id=report.rows[0].leadId;
  undoImport(data,report.id);
  assert.deepEqual(data.leads,before.leads);
  assert.ok(!data.leadActivities.some(a=>a.leadId===id));
  assert.ok(data.auditEvents.some(a=>a.action==='Undo import'));
  assert.deepEqual(report.undoSummary,{deleted:1,preserved:0,skipped:0,failed:0});
  assert.throws(()=>undoImport(data,report.id),/already reviewed/);
});
test('undo distinguishes skipped import rows, missing records and unverifiable provenance', () => {
  const data=seed(); const report=applyImport(data,request());
  const id=report.rows[0].leadId;
  report.rows[0].createdVersion=undefined;
  report.rows.push({rowNumber:3,status:'Skipped',leadId:'',message:'Duplicate skipped'},
    {rowNumber:4,status:'Failed',leadId:'',message:'Validation failed'},
    {rowNumber:5,status:'Created',leadId:'already-missing',message:'Created'});
  undoImport(data,report.id);
  assert.ok(data.leads.some(l=>l.id===id));
  assert.deepEqual(report.undoSummary,{deleted:0,preserved:0,skipped:3,failed:1});
  assert.equal(report.status,'Partially undone');
});
test('updates to existing leads are skipped by undo and retain their changes', () => {
  const data=seed(); const lead={...newLead(),name:'Existing',email:'undo@example.com'};
  data.leads.push(lead);
  const req=request(); req.strategy='update';
  const report=applyImport(data,req);
  const updated=structuredClone(data.leads.find(l=>l.id===lead.id));
  undoImport(data,report.id);
  assert.deepEqual(data.leads.find(l=>l.id===lead.id),updated);
  assert.deepEqual(report.undoSummary,{deleted:0,preserved:0,skipped:1,failed:0});
});
