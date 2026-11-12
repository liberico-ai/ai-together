// Isolated verification instance only. No credentials are printed or checked in.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Pool,escapeLiteral} from 'pg';
import {randomBytes} from 'node:crypto';
const dir='.runtime';await mkdir(dir,{recursive:true,mode:0o700});
const values=Object.fromEntries((await readFile(dir+'/postgres-test.env','utf8')).trim().split('\n').map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
const base=new URL('postgresql://127.0.0.1:5547/libetech_ai_os');base.username=values.POSTGRES_USER;base.password=values.POSTGRES_PASSWORD;
process.env.MIGRATION_DATABASE_URL=base.toString();await import('./migrate');
const pool=new Pool({connectionString:base.toString(),max:1});
const env:Record<string,string>={LIBETECH_DEMO:'0',LIBETECH_ORIGIN:'http://127.0.0.1:3148',LIBETECH_LOCAL_AUTH:'1',LIBETECH_TENANT_ID:'b63f99bf-3a85-4a1f-b74a-66b5793871ef'};
try {
 for(const [role,key] of [['libetech_web','DATABASE_URL'],['libetech_auth','IDENTITY_DATABASE_URL']]) {
  const password=randomBytes(32).toString('base64url');
  // Credential provisioning, not schema mutation; roles are defined by migration 003.
  await pool.query(`ALTER ROLE ${role} PASSWORD ${escapeLiteral(password)}`);
  const url=new URL(base);url.username=role;url.password=password;env[key]=url.toString();
 }
 const bridge={key:randomBytes(32).toString('base64url'),chatScopes:{'-1004338813921':['8f1b6aca-b20f-469a-a92b-cbde731581fc']}};
 await writeFile(dir+'/bridge.json',JSON.stringify(bridge),{mode:0o600});
 env.LIBETECH_BRIDGE_CONFIG=process.cwd()+'/'+dir+'/bridge.json';
 await writeFile(dir+'/web.env',Object.entries(env).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
 await writeFile(dir+'/migration.env','MIGRATION_DATABASE_URL='+base.toString()+'\n',{mode:0o600});
 console.log(JSON.stringify({status:'ready',storage:'native-postgresql',port:5547,roles:['libetech_web','libetech_auth'],credentials:'protected-files-only'}));
} finally {await pool.end();}
