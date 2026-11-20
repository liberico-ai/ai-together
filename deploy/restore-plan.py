"""How a data-only archive of the AI OS database is loaded: one rule, used by both installers and by the restore rehearsal (N4 of DELIVERY-016).

An archive is made as docs/DEPLOY-002.md says: pg_dump -Fc --data-only --exclude-table-data=public.schema_migrations. It is loaded into a database that already
has the migrations of the bundle and no data. Two facts decide how:

* The schema has foreign keys that no load order satisfies (document_records and document_revisions point at each other), and migration 023 puts two triggers on
  tables that an archive fills: one numbers a revision when it is stored, one compares a decision with the thread as it is now. Neither can run on rows that are
  history. So every archive is loaded with --disable-triggers (the restoring login must be a superuser; the installers' are).
* --disable-triggers ends with ENABLE TRIGGER ALL, which sets the numbering trigger of 023 from A (every session role) back to O. deploy/post-restore.sql puts it back
  and checks the result; it is the step that follows every load.

What the archive carries decides one more thing: whether its revisions have numbers. An archive of a database that had 023 carries the two number tables, and is loaded
as it is: the numbers that were given are kept (a decision carries the position of the thread as it stood; a new numbering would change what it says). An archive of a
database from before 023 carries neither, its revisions have no number, and migration 023 is applied again after the load: it numbers them in the order of created_at,
revision_no, id, which is what it does to that database in place. An archive that carries one of the two tables only was cut at dump time and is refused.

An archive is also refused when it holds no data of a table that the target has (a dump made with --exclude-table-data or -T leaves rows out without a word), when it is
classified pre-023 and yet carries a thread position in a decision (both number tables were cut out; applying 023 again would number the revisions anew and the positions
would no longer say what they said), and a target that already holds rows is refused by deploy/pre-restore.sql before the load.

Used as a program: the archive listing (pg_restore --list) on stdin; it prints post-023 or pre-023, or stops with a non-zero exit and prints nothing on stdout. With
--tables "<the tables of the target, one schema.name a line>" it also checks that the archive covers them. --pg-restore-args, --tables-sql and --pre-023-check-sql print
the arguments of pg_restore and the two queries that the installers run against the target (no stdin).
"""
from __future__ import annotations
import re,sys

# The arguments of pg_restore for every archive: the list that the installers had before N4, plus --disable-triggers (the one change).
PG_RESTORE_ARGS=('--exit-on-error','--single-transaction','--data-only','--no-owner','--disable-triggers')
NUMBER_TABLES=('source_revision_positions','intake_thread_heads')
# The tables of the target that an archive must cover: every ordinary table of every schema that is not the catalog's (a partitioned parent has no data of its own: pg_dump lists its leaves).
TABLES_SQL="SELECT n.nspname || '.' || c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT LIKE 'pg\\_%' AND n.nspname <> 'information_schema' ORDER BY 1"
# After the load of an archive classified pre-023 and before 023 is applied again: no decision may carry a position (the column exists in the target, and an archive from before 023 leaves it empty).
PRE_023_POSITIONS_SQL="SELECT count(*) FROM public.draft_decisions WHERE subject_thread_seq IS NOT NULL"

def validate_data_only_listing(listing):
    for line in listing.splitlines():
        if not line or line.startswith(';'):continue
        match=re.match(r'^\d+;\s+\d+\s+\d+\s+(.*)$',line)
        if not match or not match.group(1).startswith(('TABLE DATA ','SEQUENCE SET ')):
            raise RuntimeError('Archive must be created with pg_dump --data-only; full dumps have unsafe data order for pre-existing foreign keys')
        if 'TABLE DATA public schema_migrations ' in line:raise RuntimeError('Archive must exclude schema_migrations data')

def archive_tables(listing):
    """The tables whose data the archive carries, as schema.name."""
    return {m.group(1)+'.'+m.group(2) for m in re.finditer(r'^\d+;\s+\d+\s+\d+\s+TABLE DATA (\S+) (\S+)',listing,re.MULTILINE)}

def classify_archive(listing,target_tables=None):
    """post-023 when the archive carries the data of both number tables of migration 023, pre-023 when it carries neither; anything else is refused. With the tables of the target
    (schema.name each, schema_migrations aside) it is refused too when it holds no data of one of them: the two tables of 023 are not asked for of an archive from before 023."""
    validate_data_only_listing(listing)
    held=archive_tables(listing)
    carried=[t for t in NUMBER_TABLES if 'public.'+t in held]
    if carried and len(carried)<len(NUMBER_TABLES):
        raise RuntimeError('Archive carries only one of the two number tables of migration 023; dump again without excluding the data of either')
    kind='post-023' if carried else 'pre-023'
    if target_tables is not None:
        # An empty or unreadable list of tables must stop the load, not pass the check: nothing would have been compared.
        if 'public.projects' not in target_tables:raise RuntimeError('The tables of the target could not be read, or it is not an AI OS database; nothing was checked')
        wanted={t for t in target_tables if t and t!='public.schema_migrations'}
        if kind=='pre-023':wanted-={'public.'+t for t in NUMBER_TABLES}
        missing=sorted(wanted-held)
        if missing:raise RuntimeError('Archive holds no data of table(s): '+', '.join(missing)+'; it was cut at dump time, dump again without --exclude-table-data or -t')
    return kind

def numbers_after_load(kind):
    """Whether migration 023 is applied again after the load, to number revisions that the archive carries without a number."""
    if kind=='pre-023':return True
    if kind=='post-023':return False
    raise RuntimeError('Unknown archive kind')

def main(argv):
    if argv==['--pg-restore-args']:
        print(' '.join(PG_RESTORE_ARGS));return 0
    if argv==['--tables-sql']:
        print(TABLES_SQL);return 0
    if argv==['--pre-023-check-sql']:
        print(PRE_023_POSITIONS_SQL);return 0
    tables=None
    if len(argv)==2 and argv[0]=='--tables':tables=argv[1].split()
    elif argv:
        print('usage: restore-plan.py [--tables "<schema.name per line>"]  (the archive listing on stdin) | --pg-restore-args | --tables-sql | --pre-023-check-sql',file=sys.stderr);return 2
    try:kind=classify_archive(sys.stdin.read(),tables)
    except RuntimeError as exc:
        print(str(exc),file=sys.stderr);return 1
    print(kind);return 0

if __name__=='__main__':raise SystemExit(main(sys.argv[1:]))
