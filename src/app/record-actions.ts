'use server';
import { revalidatePath } from 'next/cache';
import { archiveRecord,saveRecord } from '@/lib/connected/repository';
import { recordModule } from '@/lib/connected/records';

export type ActionResult = {message:string; success:boolean};
export async function save(key:string,id:string|undefined,_previous:ActionResult,form:FormData):Promise<ActionResult> {
  try {
    const definition = recordModule(key);
    const values = Object.fromEntries(definition.fields.map(f => [f.key,form.get(f.key)]));
    await saveRecord(key,values,id);
    revalidatePath('/','layout');
    return {message:'Record saved.',success:true};
  } catch { return {message:'Save failed. Check the fields, connection, permissions and related records, then retry.',success:false}; }
}
export async function archive(key:string,id:string,previous:ActionResult,form:FormData):Promise<ActionResult> {
  void previous; void form;
  try { await archiveRecord(key,id); revalidatePath('/','layout'); return {message:'Record archived. Relationships and history are preserved.',success:true}; }
  catch { return {message:'Archive failed. Check your connection and permissions, then retry.',success:false}; }
}
