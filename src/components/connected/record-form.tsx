'use client';
import { useActionState } from 'react';
import { save,archive } from '@/app/record-actions';
import { recordModule } from '@/lib/connected/records';
import type { StoredRecord } from '@/lib/connected/repository';

export function RecordForm({moduleKey,record}:{moduleKey:string;record?:StoredRecord}) {
  const definition = recordModule(moduleKey);
  const [state,action,pending] = useActionState(save.bind(null,moduleKey,record?.id),{message:'',success:false});
  return <form action={action} className="connected-form">
    {definition.fields.map(f => <label key={f.key}>{f.label}{f.required ? ' *' : ''}
      {f.options ? <select name={f.key} required={f.required} defaultValue={String(record?.[f.key] ?? f.options[0])}>{f.options.map(o => <option key={o}>{o}</option>)}</select> :
      <input name={f.key} type={f.type === 'uuid' ? 'text' : f.type ?? 'text'} required={f.required} maxLength={4000} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? '0.01' : undefined} defaultValue={String(record?.[f.key] ?? (f.type === 'number' ? '0' : ''))} />}
    </label>)}
    <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : record ? 'Save changes' : 'Create record'}</button>
    {state.message && <p role="status">{state.message}</p>}
  </form>;
}
export function ArchiveForm({moduleKey,id}:{moduleKey:string;id:string}) {
  const [state,action,pending] = useActionState(archive.bind(null,moduleKey,id),{message:'',success:false});
  return <form action={action}><button className="btn" disabled={pending}>{pending ? 'Archiving…' : 'Archive record'}</button>{state.message && <p role="status">{state.message}</p>}</form>;
}
