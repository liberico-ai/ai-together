import assert from 'node:assert/strict';
import {Pool} from 'pg';
const raw=process.env.SLICE1_ADMIN_DATABASE_URL;
assert.ok(raw,'SLICE1_ADMIN_DATABASE_URL is required.');
const admin=new URL(raw);
assert.equal(admin.hostname,'127.0.0.1','This script may only use the loopback host.');
assert.equal(admin.port,'55471','This script may only use the isolated slice-1 port.');
const name='slice1_verify_'+Math.floor(Date.now()/1000);
const control=new Pool({connectionString:admin.toString(),max:1});
try {await control.query('CREATE DATABASE '+name);} finally {await control.end();}
console.log(JSON.stringify({database:name}));
