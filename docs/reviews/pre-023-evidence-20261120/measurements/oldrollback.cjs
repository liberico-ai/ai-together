const {Pool}=require('pg');
(async()=>{
  const pool=new Pool({connectionString:process.env.SLICE1_TEST_DATABASE_URL,idle_in_transaction_session_timeout:500});
  const client=await pool.connect();
  client.on('error',()=>{});   // only to keep the process alive for this measurement
  try{
    await client.query('BEGIN');
    await new Promise(r=>setTimeout(r,1500));
    throw new Error('SENTINEL');
  }catch(error){
    try{await client.query('ROLLBACK');}catch(e){console.log('old code: caller would get:',String(e.message).slice(0,60));}
  }finally{client.release();await pool.end();}
})();
