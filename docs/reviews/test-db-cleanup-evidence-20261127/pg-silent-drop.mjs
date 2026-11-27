// Run from the repository root:  SLICE1_TEST_DATABASE_URL=… node --input-type=module - < <this file>
// One pg Client through a pass-through proxy that destroys both sockets when it sees the marker: the connection ends with no word from the server.
import {connect,createServer} from 'node:net';
import {Client} from 'pg';

const upstream=new URL(process.env.SLICE1_TEST_DATABASE_URL),MARK='cut-here';
const proxy=createServer(client=>{
  const server=connect(Number(upstream.port),upstream.hostname);
  for(const socket of [client,server]) socket.on('error',()=>{});
  client.on('data',chunk=>{if(chunk.includes(MARK)){client.destroy();server.destroy();}else server.write(chunk);});
  server.pipe(client);
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const url=new URL(upstream);url.port=String(proxy.address().port);
const uncaught=[];process.on('uncaughtException',error=>uncaught.push(error.message));
for(const listener of [false,true]){
  uncaught.length=0;
  const client=new Client({connectionString:url.toString()});
  if(listener) client.on('error',()=>{});
  await client.connect();
  let rejected='(resolved)';
  try{await client.query(`SELECT 1 /* ${MARK} */`);}catch(error){rejected=error.message;}finally{await client.end();}
  await new Promise(resolve=>setTimeout(resolve,200));
  console.log(JSON.stringify({errorListener:listener,queryRejectedWith:rejected,uncaughtExceptions:uncaught}));
}
proxy.close();
