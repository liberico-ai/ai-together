"""A temporary fault in one test file; run from the repository root, then restore the file with git.
Usage: python3 -I fault.py rehearsal-template | rehearsal-reset | runner-template
  rehearsal-template  tests/restore-rehearsal.test.ts: the first database of the run is made a template, which the server refuses to drop
  rehearsal-reset     tests/restore-rehearsal.test.ts: the step of afterAll before the drops throws
  runner-template     tests/migrate-runner.test.ts: the first database of the run is made a template (same insert point before and after
                      the file moved to tests/test-databases.ts)"""
import pathlib
import sys


def edit(file, old, new):
    path = pathlib.Path(file)
    source = path.read_text()
    assert source.count(old) == 1, (file, old)
    path.write_text(source.replace(old, new))


fault = sys.argv[1]
if fault == 'rehearsal-template':
    edit('tests/restore-rehearsal.test.ts', "  const db=pooledDatabase(databases.urlOf(name));\n",
         "  const db=pooledDatabase(databases.urlOf(name));\n  if(pools.length===0) await db.query(`ALTER DATABASE \"${name}\" IS_TEMPLATE true`);\n")
elif fault == 'rehearsal-reset':
    edit('tests/restore-rehearsal.test.ts', "      await source?.reset();await source?.close();\n",
         "      throw new Error('injected fault: the reset before the drops failed');\n")
elif fault == 'runner-template':
    edit('tests/migrate-runner.test.ts', "const CUT='migrate-runner: the connection drops here';\n",
         "const CUT='migrate-runner: the connection drops here';\nlet faultMarked=false;\n")
    edit('tests/migrate-runner.test.ts', "    const directory=await mkdtemp(",
         "    if(!faultMarked){faultMarked=true;const t=pooledDatabase(url.toString());await t.query(`ALTER DATABASE \"${url.pathname.slice(1)}\" IS_TEMPLATE true`);await t.close();}\n"
         "    const directory=await mkdtemp(")
else:
    raise SystemExit('unknown fault ' + fault)
