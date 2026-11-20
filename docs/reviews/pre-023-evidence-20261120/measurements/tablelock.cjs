const {Client}=require('pg');
const url=process.env.SLICE1_TEST_DATABASE_URL;
const ins="INSERT INTO public.source_event_revisions(tenant_id,project_id,source_event_id,revision_no,revision_key,content_hash,content_mode) SELECT NULL::uuid,NULL::uuid,NULL::uuid,1,'x','y','pointer_only' WHERE false";
(async()=>{
  const a=new Client({connectionString:url}),b=new Client({connectionString:url});
  await a.connect();await b.connect();
  await a.query('BEGIN');await a.query('LOCK TABLE public.source_event_revisions IN SHARE ROW EXCLUSIVE MODE');
  for (const [label,setup] of [['statement_timeout 1 s, no lock_timeout',"SET statement_timeout=1000"],['lock_timeout 1 s',"SET statement_timeout=0; SET lock_timeout=1000"]]) {
    await b.query('RESET lock_timeout');await b.query(setup);
    const t=Date.now();
    try{await b.query(ins);console.log(label,'-> no wait?!');}catch(e){console.log(label,'->',e.code,'after',Math.round((Date.now()-t)/100)/10,'s');}
  }
  await a.query('ROLLBACK');await a.end();await b.end();
})();
