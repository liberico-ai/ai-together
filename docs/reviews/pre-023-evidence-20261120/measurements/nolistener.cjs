const {Pool}=require('pg');
process.on('uncaughtException',e=>{console.log('UNCAUGHT (process would stop):',e.code,String(e.message).slice(0,70));process.exit(0);});
(async()=>{
  const pool=new Pool({connectionString:process.env.SLICE1_TEST_DATABASE_URL,idle_in_transaction_session_timeout:500});
  const c=await pool.connect();
  await c.query('BEGIN');await c.query('SELECT 1');
  await new Promise(r=>setTimeout(r,1500));
  try{await c.query('SELECT 2');console.log('second query ok?!');}catch(e){console.log('caught in query:',e.code,String(e.message).slice(0,70));}
  c.release();await pool.end();console.log('finished normally');
})();
