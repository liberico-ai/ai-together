"""One change in tests/test-databases.ts per name; run from the repository root, then restore the file with git.
Usage: python3 -I mutate.py <M1…M6 name>"""
import pathlib
import sys

path = pathlib.Path('tests/test-databases.ts')
source = path.read_text()


def sub(old, new):
    global source
    assert source.count(old) == 1, (sys.argv[1], old)
    source = source.replace(old, new)


name = sys.argv[1]
if name == 'M1-10s-statement-timeout':
    sub("new Client({connectionString:urlOf('postgres')})", "new Client({connectionString:urlOf('postgres'),statement_timeout:10000})")
elif name == 'M2-swallow-failures':
    sub("catch(error){left.push(`${name}: ${(error as Error).message}`);}", "catch{}")
elif name == 'M3-stop-at-first-failure':
    sub("catch(error){left.push(`${name}: ${(error as Error).message}`);}", "catch(error){left.push(`${name}: ${(error as Error).message}`);break;}")
elif name == 'M4-one-client-for-all-drops':
    sub("  async function onServer(sql:string):Promise<void>{\n",
        "  let shared:Client|undefined;\n  async function onServer(sql:string):Promise<void>{\n    if(shared){await shared.query(sql);return;}\n")
    sub("    await client.connect();\n    try{await client.query(sql);}finally{await client.end();}\n",
        "    await client.connect();\n    shared=client;\n    await client.query(sql);\n")
elif name == 'M5-no-error-listener':
    sub("    client.on('error',()=>{});\n", "")
elif name == 'M6-name-kept-before-create':
    sub("      try{await onServer(`CREATE", "      created.push(name);\n      try{await onServer(`CREATE")
    sub("\n      created.push(name);\n      return name;", "\n      return name;")
else:
    raise SystemExit('unknown mutation ' + name)
path.write_text(source)
