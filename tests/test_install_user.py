"""Regression guards for restoring a data archive into an existing schema."""
import contextlib,hashlib,importlib.util,io,json,re,subprocess,sys,tempfile,unittest
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('user_installer',Path(__file__).resolve().parents[1]/'deploy/install-user.py')
installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)

class ArchiveGuards(unittest.TestCase):
    def test_data_only_archive_is_accepted(self):
        installer.validate_data_only_listing('; archive header\n123; 0 12345 TABLE DATA public projects iptech\n124; 0 12346 TABLE DATA analytics reconciliations iptech\n')
    def test_full_archive_is_rejected_before_data_restore(self):
        with self.assertRaisesRegex(RuntimeError,'pg_dump --data-only'):
            installer.validate_data_only_listing('123; 1259 12345 TABLE public projects iptech\n')
    def test_schema_version_rows_must_not_be_restored(self):
        with self.assertRaisesRegex(RuntimeError,'schema_migrations'):
            installer.validate_data_only_listing('123; 0 12345 TABLE DATA public schema_migrations iptech\n')
    def test_protected_files_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'value';installer.exclusive(p,'first')
            with self.assertRaises(FileExistsError):installer.exclusive(p,'second')
            self.assertEqual(p.read_text(),'first')
    def test_source_drift_stops_bundle_verification(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'deploy').mkdir();(root/'code.txt').write_text('reviewed')
            hashes={'code.txt':hashlib.sha256(b'reviewed').hexdigest()}
            manifest={'files':hashes,'treeSha256':hashlib.sha256(json.dumps(hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
            (root/'deploy/BUNDLE-MANIFEST.json').write_text(json.dumps(manifest))
            installer.verify_bundle(root);(root/'code.txt').write_text('team change')
            with self.assertRaisesRegex(RuntimeError,'content mismatch'):installer.verify_bundle(root)

class PilotChats(unittest.TestCase):
    """Real chat IDs stay on the server (audit 2026-11-12, option c); the loader fails closed."""
    def write(self,d,data,mode=0o600):
        p=Path(d)/'pilot-chats.json';p.write_text(data if isinstance(data,str) else json.dumps(data));p.chmod(mode);return p
    def test_valid_file_is_loaded(self):
        with tempfile.TemporaryDirectory() as d:
            p=self.write(d,{'internalChatId':'-10012345','deniedChatIds':['-10067890']})
            self.assertEqual(installer.load_pilot_chats(str(p)),('-10012345',['-10067890']))
    def test_unset_setting_stops_installation(self):
        for value in (None,''):
            with self.assertRaisesRegex(RuntimeError,'LIBETECH_PILOT_CHATS'):installer.load_pilot_chats(value)
    def test_missing_file_stops_installation(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(RuntimeError,'regular file'):installer.load_pilot_chats(str(Path(d)/'absent.json'))
    def test_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            target=self.write(d,{'internalChatId':'-10012345','deniedChatIds':[]});link=Path(d)/'link.json';link.symlink_to(target)
            with self.assertRaisesRegex(RuntimeError,'regular file'):installer.load_pilot_chats(str(link))
    def test_file_readable_by_others_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p=self.write(d,{'internalChatId':'-10012345','deniedChatIds':[]},mode=0o644)
            with self.assertRaisesRegex(RuntimeError,'0600'):installer.load_pilot_chats(str(p))
    def test_malformed_content_is_rejected(self):
        bad=['not json','[]',{'deniedChatIds':[]},{'internalChatId':'-10012345'},
             {'internalChatId':'10012345','deniedChatIds':[]},{'internalChatId':'-12','deniedChatIds':[]},
             {'internalChatId':-10012345,'deniedChatIds':[]},{'internalChatId':'-10012345','deniedChatIds':'-10067890'},
             {'internalChatId':'-10012345','deniedChatIds':['-10067890',7]},{'internalChatId':'-10012345','deniedChatIds':['-10012345']},
             # The bridge only accepts ^-[1-9][0-9]*$ (src/app/api/bridge/route.ts); a leading zero must stop the install.
             {'internalChatId':'-00000','deniedChatIds':[]},{'internalChatId':'-10012345','deniedChatIds':['-012345']}]
        with tempfile.TemporaryDirectory() as d:
            for data in bad:
                with self.subTest(data=data):
                    p=self.write(d,data)
                    with self.assertRaisesRegex(RuntimeError,'pilot chat file'):installer.load_pilot_chats(str(p))
                    p.unlink()
    def test_only_the_approved_group_gets_the_project(self):
        self.assertEqual(installer.chat_scopes(('-10012345',['-10067890','-10011111'])),
                         {'-10012345':[installer.PROJECT],'-10067890':[],'-10011111':[]})
    @unittest.skipUnless(importlib.util.find_spec('yaml'),'PyYAML is required on d1-ai1 and for this check')
    def test_recipient_must_match_live_home_channel(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d)/'config.yaml').write_text('platforms:\n  telegram:\n    home_channel:\n      chat_id: -10012345\n')
            installer.check_recipient(('-10012345',[]),Path(d))
            with self.assertRaisesRegex(RuntimeError,'recipient drift'):installer.check_recipient(('-10099999',[]),Path(d))
    @unittest.skipUnless(importlib.util.find_spec('yaml'),'PyYAML is required on d1-ai1 and for this check')
    def test_unreadable_home_channel_never_echoes_the_chat_id(self):
        broken=['platforms:\n  telegram:\n    home_channel:\n      chat_id: -10012345 : bad\n','platforms: {}\n','[]\n']
        with tempfile.TemporaryDirectory() as d:
            for text in broken:
                with self.subTest(text=text):
                    (Path(d)/'config.yaml').write_text(text)
                    with self.assertRaisesRegex(RuntimeError,'home_channel') as caught:installer.check_recipient(('-10012345',[]),Path(d))
                    self.assertNotIn('10012345',str(caught.exception))
                    self.assertIsNone(caught.exception.__cause__);self.assertTrue(caught.exception.__suppress_context__)
    def test_resume_path_checks_the_recipient_before_writing(self):
        source=(Path(__file__).resolve().parents[1]/'deploy/install-user.py').read_text()
        resume=source[source.index('def resume_empty_database'):]
        self.assertLess(resume.index('check_recipient(chats)'),resume.index('finish_install('))
    def test_root_installer_validates_chats_before_creating_anything(self):
        lines=[l for l in (Path(__file__).resolve().parents[1]/'deploy/install-d1.sh').read_text().splitlines() if not l.lstrip().startswith('#')]
        at=lambda needle:next(i for i,l in enumerate(lines) if needle in l)
        preflight=at('provision-server.py" --preflight')
        # (the root-only snapshot of the bundle in a temp directory, and its checks, come first on purpose: the preflight itself runs from it; it changes nothing of the system)
        for mutation in ('apt-get','useradd','install -d','cp -a "$node_source"','pg_createcluster','pg_restore'):
            self.assertLess(preflight,at(mutation),mutation)
        provision=(Path(__file__).resolve().parents[1]/'deploy/provision-server.py').read_text()
        self.assertLess(provision.index('check_recipient('),provision.index("save(state/'bridge.json'"))
    def test_repository_scope_has_no_chat_ids(self):
        text=(Path(__file__).resolve().parents[1]/'deploy/pilot-scope.json').read_text()
        scope=json.loads(text)
        self.assertNotIn('internalChatId',scope);self.assertNotIn('deniedChatIds',scope)
        self.assertIsNone(re.search(r'(?<![\w-])-\d{5,}',text))
DEPLOY=Path(__file__).resolve().parents[1]/'deploy'
DATA_ONLY_BEFORE_023='; Archive created\n1; 0 1 TABLE DATA public projects iptech\n2; 0 2 TABLE DATA public source_event_revisions iptech\n3; 0 3 SEQUENCE SET public some_seq iptech\n'
NUMBER_TABLES='4; 0 4 TABLE DATA public source_revision_positions iptech\n5; 0 5 TABLE DATA public intake_thread_heads iptech\n'

class RestorePlan(unittest.TestCase):
    """N4 (DELIVERY-016): one rule, in deploy/restore-plan.py, for what an archive is and how it is loaded; both installers and the rehearsal use it."""
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('restore_plan',DEPLOY/'restore-plan.py')
        cls.plan=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.plan)
    def test_u1_an_archive_that_carries_both_number_tables_was_taken_after_023(self):
        self.assertEqual(self.plan.classify_archive(DATA_ONLY_BEFORE_023+NUMBER_TABLES),'post-023')
        self.assertEqual(self.plan.classify_archive(DATA_ONLY_BEFORE_023),'pre-023')
    def test_u1_an_archive_with_only_one_of_the_two_is_refused(self):
        for table in NUMBER_TABLES.splitlines():
            with self.subTest(table=table):
                with self.assertRaisesRegex(RuntimeError,'number tables'):self.plan.classify_archive(DATA_ONLY_BEFORE_023+table+'\n')
    def test_u1_a_full_archive_is_refused_before_it_is_classified(self):
        with self.assertRaisesRegex(RuntimeError,'pg_dump --data-only'):self.plan.classify_archive('1; 1259 1 TABLE public projects iptech\n'+NUMBER_TABLES)
    def test_u2_every_archive_is_loaded_with_the_same_arguments_and_triggers_off(self):
        # the argument list of install-user.py before N4, plus exactly one flag
        self.assertEqual(list(self.plan.PG_RESTORE_ARGS),['--exit-on-error','--single-transaction','--data-only','--no-owner','--disable-triggers'])
    def test_u3_only_an_archive_from_before_023_is_numbered_after_the_load(self):
        self.assertTrue(self.plan.numbers_after_load('pre-023'))
        self.assertFalse(self.plan.numbers_after_load('post-023'))
        with self.assertRaises(RuntimeError):self.plan.numbers_after_load('anything else')
    def run_cli(self,listing):
        return subprocess.run([sys.executable,'-I',str(DEPLOY/'restore-plan.py')],input=listing,text=True,capture_output=True)
    def test_u4_the_command_line_prints_one_word_for_the_shell_installer(self):
        for listing,word in ((DATA_ONLY_BEFORE_023+NUMBER_TABLES,'post-023'),(DATA_ONLY_BEFORE_023,'pre-023')):
            with self.subTest(word=word):
                r=self.run_cli(listing);self.assertEqual((r.returncode,r.stdout),(0,word+'\n'))
    def test_u4_the_command_line_stops_the_shell_installer_and_prints_nothing_on_a_refused_archive(self):
        for listing in ('1; 1259 1 TABLE public projects iptech\n',DATA_ONLY_BEFORE_023+NUMBER_TABLES.splitlines()[0]+'\n',
                        DATA_ONLY_BEFORE_023+'9; 0 9 TABLE DATA public schema_migrations iptech\n'):
            with self.subTest(listing=listing):
                r=self.run_cli(listing);self.assertNotEqual(r.returncode,0);self.assertEqual(r.stdout,'')
    def test_u4_the_installer_keeps_its_old_name_for_the_listing_check(self):
        # the tests of the first class call it through the installer; the rule has one home
        self.assertIs(installer.validate_data_only_listing,installer.restore_plan.validate_data_only_listing)
    TARGET='public.projects\npublic.source_event_revisions\npublic.schema_migrations\npublic.source_revision_positions\npublic.intake_thread_heads\nidentity.users\n'
    FULL=DATA_ONLY_BEFORE_023+'6; 0 6 TABLE DATA public source_event_revisions iptech\n7; 0 7 TABLE DATA identity users iptech\n'
    def test_u10_an_archive_must_hold_the_data_of_every_table_of_the_target(self):
        target=self.TARGET.split()
        self.assertEqual(self.plan.classify_archive(self.FULL+NUMBER_TABLES,target),'post-023')
        # the two tables of 023 are not asked of an archive from before 023, schema_migrations never
        self.assertEqual(self.plan.classify_archive(self.FULL,target),'pre-023')
        left_out=''.join(l+'\n' for l in (self.FULL+NUMBER_TABLES).splitlines() if 'identity users' not in l)
        with self.assertRaisesRegex(RuntimeError,r'identity\.users'):self.plan.classify_archive(left_out,target)
        with self.assertRaisesRegex(RuntimeError,'cut at dump time'):self.plan.classify_archive(left_out,target)
    def test_u10_a_list_of_tables_that_is_empty_or_unreadable_stops_the_load_instead_of_passing_the_check(self):
        for target in ([],[''],['identity.users']):
            with self.subTest(target=target):
                with self.assertRaisesRegex(RuntimeError,'could not be read'):self.plan.classify_archive(self.FULL+NUMBER_TABLES,target)
        r=subprocess.run([sys.executable,'-I',str(DEPLOY/'restore-plan.py'),'--tables',''],input=self.FULL,text=True,capture_output=True)
        self.assertNotEqual(r.returncode,0);self.assertEqual(r.stdout,'')
    def test_u2_the_load_command_of_the_runbook_is_typed_in_full_and_is_the_list_of_the_plan(self):
        text=(DEPLOY.parent/'docs/RUNBOOK-RESTORE-AFTER-023.md').read_text()
        commands=[l for l in text.splitlines() if l.startswith('pg_restore ')]
        loads=[c for c in commands if '--data-only' in c]
        self.assertEqual(len(loads),1)
        self.assertEqual(loads[0].split()[1:6],list(self.plan.PG_RESTORE_ARGS),'the five arguments, in the order of restore-plan.py')
        self.assertNotIn('$(',loads[0],'a command substitution that fails would leave the arguments out')
    def test_u10_the_tables_asked_for_are_ordinary_tables_and_the_leaves_of_a_partitioned_one(self):
        sql=self.plan.TABLES_SQL
        self.assertIn("relkind = 'r'",sql);self.assertNotIn('relispartition',sql);self.assertIn("NOT LIKE 'pg\\_%'",sql)
    def test_u10_without_the_tables_of_the_target_nothing_more_is_asked(self):
        self.assertEqual(self.plan.classify_archive(DATA_ONLY_BEFORE_023),'pre-023')
    def test_u10_the_command_line_takes_the_tables_of_the_target(self):
        def cli(listing,tables):return subprocess.run([sys.executable,'-I',str(DEPLOY/'restore-plan.py'),'--tables',tables],input=listing,text=True,capture_output=True)
        ok=cli(self.FULL+NUMBER_TABLES,self.TARGET);self.assertEqual((ok.returncode,ok.stdout),(0,'post-023\n'))
        bad=cli(DATA_ONLY_BEFORE_023,self.TARGET);self.assertNotEqual(bad.returncode,0);self.assertEqual(bad.stdout,'');self.assertIn('identity.users',bad.stderr)
    def test_u10_the_queries_that_the_installers_run_are_printed_by_the_same_file(self):
        for flag,constant in (('--tables-sql','TABLES_SQL'),('--pre-023-check-sql','PRE_023_POSITIONS_SQL')):
            r=subprocess.run([sys.executable,'-I',str(DEPLOY/'restore-plan.py'),flag],capture_output=True,text=True)
            self.assertEqual((r.returncode,r.stdout.strip()),(0,getattr(self.plan,constant)))
        r=subprocess.run([sys.executable,'-I',str(DEPLOY/'restore-plan.py'),'--pg-restore-args'],capture_output=True,text=True)
        self.assertEqual(r.stdout.split(),list(self.plan.PG_RESTORE_ARGS))

class RestoreSteps(unittest.TestCase):
    """N4: what the two installers do with an archive, and in which order. They cannot run end to end from this tree (the bundle manifest is the one of 0.2.0), so the steps are pinned here."""
    TARGET_TABLES='public.projects\npublic.source_event_revisions\npublic.schema_migrations\npublic.source_revision_positions\npublic.intake_thread_heads\n'
    def setUp(self):
        self.silent_about_kind=False;self.calls=[];self.positions='0';self.answer={'post_restore':'pass','thread_order':'checked','held_by_project':[]};self.fail_on=None
        self.saved=(installer.run,installer.run_post_restore,installer.run_pre_restore,installer.BASE)
        def fake_run(args,*,env=None,cwd=None,stdin=None,quiet=False):
            args=[str(a) for a in args];self.calls.append(('run',args,stdin))
            if self.fail_on and self.fail_on(args,stdin):raise RuntimeError('tool failed with exit 1')
            if '--list' in args:return self.listing
            if installer.restore_plan.TABLES_SQL in args:return self.TARGET_TABLES
            if installer.restore_plan.PRE_023_POSITIONS_SQL in args:return self.positions+'\n'
            return ''
        installer.run=fake_run
        installer.run_pre_restore=lambda sql,env,text:self.calls.append(('pre-restore',text))
        def fake_post(sql,env,text,kind):
            self.calls.append(('post-restore',text,kind))
            # the real file echoes the kind that it was told (archive_kind); a case can say that it did not, or that it said another
            return dict(self.answer) if self.silent_about_kind else {'archive_kind':kind,**self.answer}
        installer.run_post_restore=fake_post
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name)
        (root/'app/migrations').mkdir(parents=True);(root/'app/deploy').mkdir(parents=True)
        (root/'app/migrations/023_thread_order.sql').write_text('-- migration 023');(root/'app/deploy/post-restore.sql').write_text('-- post restore')
        (root/'app/deploy/pre-restore.sql').write_text('-- pre restore')
        installer.BASE=root
    def tearDown(self):
        installer.run,installer.run_post_restore,installer.run_pre_restore,installer.BASE=self.saved;self.tmp.cleanup()
    def steps(self,listing):
        self.listing=listing
        installer.restore_data(Path('/pg/bin'),{},Path('/archive.dump'),[Path('/pg/bin/psql'),'-q'])
        out=[]
        for kind,*rest in self.calls:
            if kind in ('post-restore','pre-restore'):out.append(kind);continue
            args,stdin=rest
            if '--list' in args:out.append('list')
            elif args[0].endswith('pg_restore'):out.append('restore')
            elif stdin=='-- migration 023':out.append('apply-023')
            elif installer.restore_plan.TABLES_SQL in args:out.append('tables')
            elif installer.restore_plan.PRE_023_POSITIONS_SQL in args:out.append('position-check')
            else:out.append('other')
        return out
    # the archive of a database that had every table of the target (and the two of 023, or not)
    FULL=DATA_ONLY_BEFORE_023+'6; 0 6 TABLE DATA public source_event_revisions iptech\n'
    def test_u3_a_post_023_archive_is_loaded_and_checked_and_nothing_numbers_it_again(self):
        self.assertEqual(self.steps(self.FULL+NUMBER_TABLES),['list','tables','pre-restore','restore','post-restore'])
    def test_u3_a_pre_023_archive_is_numbered_by_applying_023_again_before_the_check(self):
        self.assertEqual(self.steps(self.FULL),['list','tables','pre-restore','restore','position-check','apply-023','post-restore'])
    def test_u2_the_load_is_one_transaction_with_triggers_off_for_either_kind(self):
        for listing in (self.FULL,self.FULL+NUMBER_TABLES):
            with self.subTest(listing=listing[-30:]):
                self.calls=[];self.steps(listing)
                restore=next(a for k,a,_ in (c for c in self.calls if c[0]=='run') if a[0].endswith('pg_restore') and '--list' not in a)
                for flag in ('--exit-on-error','--single-transaction','--data-only','--no-owner','--disable-triggers'):self.assertIn(flag,restore)
    def test_u3_an_archive_that_is_refused_loads_nothing(self):
        for label,listing in (('full dump','1; 1259 1 TABLE public projects iptech\n'),('one number table',self.FULL+NUMBER_TABLES.splitlines()[0]+'\n'),
                              ('a table of the target left out',NUMBER_TABLES+'1; 0 1 TABLE DATA public projects iptech\n')):
            with self.subTest(label=label):
                self.calls=[]
                with self.assertRaises(RuntimeError):self.steps(listing)
                self.assertEqual([c for c in self.calls if c[0]=='pre-restore' or c[0]=='run' and c[1][0].endswith('pg_restore') and '--list' not in c[1]],[])
    def test_u3_the_target_must_be_empty_before_anything_is_loaded(self):
        self.assertLess(self.steps(self.FULL).index('pre-restore'),self.steps(self.FULL).index('restore'))
    def test_u3_a_pre_023_archive_that_carries_positions_is_not_numbered_again(self):
        self.positions='3'
        with self.assertRaisesRegex(RuntimeError,'thread positions'):self.steps(self.FULL)
        self.assertNotIn('apply-023',[('apply-023' if c[0]=='run' and c[2]=='-- migration 023' else '') for c in self.calls])
        self.assertEqual([c for c in self.calls if c[0]=='post-restore'],[])
    def test_u3b_a_target_that_is_not_empty_stops_before_the_load(self):
        def refuse(sql,env,text):self.calls.append(('pre-restore',text));raise RuntimeError('Pre-restore check failed (PRE-RESTORE-02)')
        installer.run_pre_restore=refuse
        with self.assertRaisesRegex(RuntimeError,'PRE-RESTORE-02'):self.steps(self.FULL)
        self.assertEqual([c for c in self.calls if c[0]=='run' and c[1][0].endswith('pg_restore') and '--list' not in c[1]],[])
        self.assertEqual([c for c in self.calls if c[0]=='post-restore'],[])
    def test_u3b_a_load_that_fails_is_not_numbered_and_not_checked(self):
        self.fail_on=lambda args,stdin:args[0].endswith('pg_restore') and '--list' not in args
        with self.assertRaises(RuntimeError):self.steps(self.FULL)
        self.assertEqual([c for c in self.calls if c[0]=='post-restore' or c[0]=='run' and c[2]=='-- migration 023'],[])
    def test_u3b_a_check_that_answers_without_the_checks_of_023_is_not_a_pass(self):
        self.answer={'post_restore':'pass','thread_order':'023 not applied'}
        with self.assertRaisesRegex(RuntimeError,'without the checks of migration 023'):self.steps(self.FULL)
    def test_u3b_the_answer_of_the_check_is_what_the_restore_returns(self):
        self.listing=self.FULL;self.assertEqual(installer.restore_data(Path('/pg/bin'),{},Path('/archive.dump'),[Path('/pg/bin/psql'),'-q']),{**self.answer,'archive_kind':'pre-023'})
    # OQ-59 (b) (1), the Chairman's answer of 22/11/2026: an archive of a source that already held threads (revisions without a number) is restored as it is, the service is started, and
    # the threads stay held. Until then the installers stopped at POST-RESTORE-05; that code is no longer a refusal.
    # (the two stray keys are not in the real answer; they are here so that the assertions that the installer prints no chat and no thread can fail)
    STRAY={'chat_id':'stray-chat-value','thread_key':'stray-thread-value'}
    # two projects, so that a figure that adds them up (Codex gate, run 3: reports never aggregate across reporting domains) would show: the answer is per project and so is what the installers print
    HELD={'post_restore':'pass','thread_order':'checked','held_by_project':[{'project_no':1,'revisions':3,'threads':2},{'project_no':2,'revisions':1,'threads':1}],**STRAY}
    def restore_shown(self,listing):
        """The steps the installer took, and what it printed while it took them."""
        out=io.StringIO()
        with contextlib.redirect_stdout(out):steps=self.steps(listing)
        return steps,out.getvalue()
    def test_u11_a_post_023_archive_whose_source_held_threads_is_restored_to_the_end_and_the_count_is_shown(self):
        self.answer=dict(self.HELD)
        steps,shown=self.restore_shown(self.FULL+NUMBER_TABLES)
        self.assertEqual(steps,['list','tables','pre-restore','restore','post-restore'],'nothing numbers it, nothing stops it')
        for fragment in ('project 1: 3 revision(s) in 2 thread(s)','project 2: 1 revision(s) in 1 thread(s)','OQ-59','RUNBOOK-RESTORE-AFTER-023'):self.assertIn(fragment,shown)
        for leaked in ('chat','project_no','-100','stray-chat-value','stray-thread-value'):self.assertNotIn(leaked,shown,'counts only')
        self.assertEqual(shown,'\n'.join(installer.held_lines(self.HELD['held_by_project']))+'\n','exactly one line for each project and one sentence: no total over the projects')
        self.listing=self.FULL+NUMBER_TABLES
        with contextlib.redirect_stdout(io.StringIO()):restored=installer.restore_data(Path('/pg/bin'),{},Path('/archive.dump'),[Path('/pg/bin/psql'),'-q'])
        self.assertEqual(restored,{**self.HELD,'archive_kind':'post-023'},'the answer goes into the receipt as it is')
    def test_u11_an_archive_with_no_held_thread_prints_nothing_about_it(self):
        self.assertEqual(self.restore_shown(self.FULL+NUMBER_TABLES)[1],'')
    def test_u11_the_two_kind_words_are_the_same_in_every_place_that_names_them(self):
        # five places name the words of the archive kind (the plan, the SQL file, the installer's list, the shell guard, the shell reader); each fails closed alone, and this ties them together
        words={'post-023','pre-023'};plan=installer.restore_plan
        self.assertEqual(set(installer.ARCHIVE_KINDS),words)
        self.assertEqual({plan.classify_archive(DATA_ONLY_BEFORE_023+'6; 0 6 TABLE DATA public source_event_revisions iptech\n'+NUMBER_TABLES),plan.classify_archive(DATA_ONLY_BEFORE_023+'6; 0 6 TABLE DATA public source_event_revisions iptech\n')},words)
        sql=(DEPLOY/'post-restore.sql').read_text();shell=(DEPLOY/'install-d1.sh').read_text()
        self.assertEqual(set(re.findall(r"IN \('([a-z0-9-]+)', '([a-z0-9-]+)'\)",sql)[0]),words)
        self.assertEqual(set(re.search(r'\[\[ "\$kind" == (\S+) \|\| "\$kind" == (\S+) \]\]',shell).groups()),words)
        self.assertEqual(set(re.search(r'kind not in \("([a-z0-9-]+)","([a-z0-9-]+)"\)',shell).groups()),words)
    def test_u11_the_check_is_told_the_kind_of_the_archive_that_the_plan_named(self):
        # Codex gate, round 1: the file cannot tell an archive of before 023 that was not numbered from a source that held threads, so it is TOLD (`pre-023` / `post-023`, the word that restore-plan.py
        # printed at step 3) and refuses the first (POST-RESTORE-05). One rule, in one place: the installers do not judge the count themselves.
        for listing,kind in ((self.FULL,'pre-023'),(self.FULL+NUMBER_TABLES,'post-023')):
            with self.subTest(kind=kind):
                self.calls=[];self.steps(listing)
                self.assertEqual([c[2] for c in self.calls if c[0]=='post-restore'],[kind])
    BAD_HELD=(('no key at all',None),('null',None),('not a list','x'),('an entry that is not an object',[1]),
              ('a negative count',[{'project_no':1,'revisions':-1,'threads':1}]),('a boolean',[{'project_no':1,'revisions':True,'threads':1}]),
              ('a string',[{'project_no':1,'revisions':'3','threads':1}]),('a float',[{'project_no':1,'revisions':1.5,'threads':1}]),
              ('no thread count',[{'project_no':1,'revisions':1}]),('no project number',[{'revisions':1,'threads':1}]),('project number zero',[{'project_no':0,'revisions':1,'threads':1}]))
    def test_u11_the_counts_must_be_in_the_answer_per_project_as_whole_numbers_or_the_check_is_not_a_pass(self):
        for label,value in self.BAD_HELD:
            for listing in (self.FULL,self.FULL+NUMBER_TABLES):
                with self.subTest(label=label,kind=listing[-20:]):
                    self.calls=[];self.answer={**self.HELD,'held_by_project':value}
                    if label=='no key at all':del self.answer['held_by_project']
                    with self.assertRaisesRegex(RuntimeError,'count of revisions'),contextlib.redirect_stdout(io.StringIO()):self.steps(listing)
    def test_u11_the_answer_must_say_the_kind_that_the_check_was_told_or_it_is_not_a_pass(self):
        # a check that did not see the kind (an old file, a skewed pair of installer and file) has not applied the rule for it
        for listing,other in ((self.FULL,'post-023'),(self.FULL+NUMBER_TABLES,'pre-023')):
            for label,says in (('another kind',other),('no kind',None)):
                with self.subTest(label=label,told=listing[-20:]):
                    self.calls=[];self.answer={**self.HELD,'archive_kind':says} if says else dict(self.HELD);self.silent_about_kind=True
                    with self.assertRaisesRegex(RuntimeError,'did not say the kind'),contextlib.redirect_stdout(io.StringIO()):self.steps(listing)
    def test_u3b_applying_023_again_that_stops_names_a_reason_among_several_and_the_exit_only(self):
        self.fail_on=lambda args,stdin:stdin=='-- migration 023'
        with self.assertRaises(RuntimeError) as caught:self.steps(self.FULL)
        self.assertIn('stopped',str(caught.exception));self.assertIn('for other reasons',str(caught.exception));self.assertIn('exit 1',str(caught.exception))
        self.assertEqual([c for c in self.calls if c[0]=='post-restore'],[])
    def test_u5_the_installer_checks_the_restore_before_it_creates_a_password_or_a_service(self):
        source=(DEPLOY/'install-user.py').read_text();finish=source[source.index('def finish_install'):source.index('def resume_empty_database')]
        order=[finish.index(n) for n in ('restore_data(','dump.unlink()',"ALTER ROLE libetech_web","'enable','--now',UNIT_NAMES[1]")]
        self.assertEqual(order,sorted(order))
        body=source[source.index('def restore_data'):source.index('def finish_install')]
        order=[body.index(n) for n in ('classify_archive(','run_pre_restore(','PG_RESTORE_ARGS','PRE_023_POSITIONS_SQL','023_thread_order.sql','run_post_restore(')]
        self.assertEqual(order,sorted(order))
    @staticmethod
    def shell_lines():
        return [l for l in (DEPLOY/'install-d1.sh').read_text().splitlines() if not l.lstrip().startswith('#')]
    def test_u6_the_root_installer_holds_the_archive_once_then_loads_checks_and_only_then_starts_the_service(self):
        lines=self.shell_lines()
        at=lambda needle:next(i for i,l in enumerate(lines) if needle in l)
        order=[at('sha256sum'),at('--tables-sql'),at('< "$snap/deploy/pre-restore.sql"'),at('--pg-restore-args'),at('pg_restore "${restore_args[@]}"'),at('--pre-023-check-sql'),
               at('< "$snap/migrations/023_thread_order.sql"'),at('< "$snap/deploy/post-restore.sql"'),
               next(i for i,l in enumerate(lines) if 'provision-server.py"' in l and '--preflight' not in l),at('systemctl enable')]
        self.assertEqual(order,sorted(order),order)
        text='\n'.join(lines)
        self.assertNotIn('pg_restore --exit-on-error --single-transaction --data-only --no-owner -p',text,'the old command is gone')
        self.assertIn('disable-triggers',(DEPLOY/'restore-plan.py').read_text())
        # the archive is read once: after the copy every step reads the copy
        copy=at('cat -- "$dump"')
        self.assertEqual([i for i,l in enumerate(lines) if '"$dump"' in l and i!=copy and 'dump=' not in l and '[[ -f' not in l],[],'only the copy is read twice')
        self.assertIn('LIBETECH_ARCHIVE_SHA256',text)
    def test_u6b_the_root_installer_is_valid_shell(self):
        self.assertEqual(subprocess.run(['bash','-n',str(DEPLOY/'install-d1.sh')],capture_output=True).returncode,0)
    def test_u6c_the_root_installer_reads_psql_answers_tersely_and_asks_for_the_files_in_the_manifest(self):
        text='\n'.join(self.shell_lines())
        runs=[l for l in text.splitlines() if any(f'< "$snap/{n}"' in l for n in ('deploy/post-restore.sql','deploy/pre-restore.sql','migrations/023_thread_order.sql'))]
        self.assertEqual(len(runs),3)
        for line in runs:
            self.assertIn('VERBOSITY=terse',line);self.assertIn('SHOW_CONTEXT=never',line)
        for name in ('deploy/pre-restore.sql','deploy/post-restore.sql','deploy/restore-plan.py','migrations/023_thread_order.sql'):self.assertIn(name,text)
    def test_u6d_nothing_runs_from_the_bundle_before_root_has_copied_it_and_nothing_is_read_from_it_after(self):
        lines=self.shell_lines()
        at=lambda needle:next(i for i,l in enumerate(lines) if needle in l)
        made=at('work=$(mktemp -d /root/.libetech-restore.');snap_dir=at('mkdir "$snap"');copy=at('cp -a "$bundle/." "$snap/"');checked=at('tree=$(check_bundle "$snap")')
        self.assertLess(made,snap_dir);self.assertLess(snap_dir,copy);self.assertLess(copy,checked)
        # before the copy no command is run from the bundle: it is named once, for the directory of the script
        self.assertEqual([l for l in lines[:copy] if '$bundle' in l and not l.startswith('bundle=')],[],'only the directory of the script is read from the bundle')
        for l in lines[:copy]:self.assertNotIn('verify-bundle',l)
        self.assertEqual([l for l in lines[copy+1:] if '$bundle' in l],[],'after the copy every later step reads the snapshot')
        text=' '.join(lines)
        self.assertIn('snap="$work/bundle"',text);self.assertIn('rm -rf -- "$snap"',text)
        self.assertNotIn('verify-bundle.py',text,'the checker is part of the reviewed script, not a file of the bundle')
        # the copy under /opt is made from the snapshot, and nothing that runs as root or postgres reads it
        self.assertIn('cp -a "$snap/." /opt/libetech-ai-os/app/',text)
        for l in lines[copy+1:]:
            if 'python3' in l or '< "' in l:self.assertNotIn('/opt/libetech-ai-os/app',l)
        # the release is named by the operator, who must give its digest (it is not optional), and the checker's digest must be equal to it
        self.assertIn('release_sha=${LIBETECH_BUNDLE_TREE_SHA256:-}',text);self.assertIn('[[ "$release_sha" =~ ^[0-9a-f]{64}$ ]]',text);self.assertIn('[[ "$tree" == "$release_sha" ]]',text)
        self.assertLess(text.index('release_sha=${'),text.index('mktemp'),'asked for before anything is created')
        self.assertNotIn('-n "${LIBETECH_BUNDLE_TREE_SHA256',text,'not an optional check')
    @staticmethod
    def checker():
        text=(DEPLOY/'install-d1.sh').read_text();start=text.index("<<'PY'\n")+len("<<'PY'\n")
        return text[start:text.index('\nPY\n',start)]
    def make_bundle(self,root,extra_deploy=(),skip=()):
        files={}
        def add(rel,data=b'x'):
            p=root/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);files[rel]=hashlib.sha256(data).hexdigest()
        for rel in ('deploy/pre-restore.sql','deploy/post-restore.sql','deploy/restore-plan.py','deploy/preflight.py','deploy/install-d1.sh','migrations/001_a.sql','migrations/023_thread_order.sql','migrations/rollback/023_thread_order.sql','package.json'):
            if rel not in skip:add(rel,rel.encode())
        manifest={'files':files,'treeSha256':hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
        (root/'deploy/BUNDLE-MANIFEST.json').write_text(json.dumps(manifest));return manifest
    def run_checker(self,root):
        return subprocess.run([sys.executable,'-I','-',str(root)],input=self.checker(),text=True,capture_output=True)
    def test_u6h_the_checker_that_is_part_of_the_script_accepts_a_whole_bundle_and_prints_its_digest(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);manifest=self.make_bundle(root)
            (root/'docs').mkdir();(root/'docs/SOURCE-MANIFEST.json').write_text('{}')  # the two manifests that the packaging writes are allowed
            r=self.run_checker(root);self.assertEqual((r.returncode,r.stdout.strip()),(0,manifest['treeSha256']),r.stderr)
    def test_u6h_the_checker_refuses_what_a_swapped_or_added_file_would_be(self):
        cases={}
        def tampered(root):(root/'deploy/post-restore.sql').write_bytes(b'select 1')
        def unlisted_deploy(root):(root/'deploy/json.py').write_text('print(1)')
        def unlisted_migration(root):(root/'migrations/024_unlisted.sql').write_text('x')
        def unlisted_anywhere(root):(root/'sitecustomize.py').write_text('print(1)')
        def sourceless_bytecode(root):(root/'deploy/yaml.pyc').write_bytes(b'\x00\x00')  # python imports a .pyc that has no source beside it
        def bytecode_cache(root):(root/'deploy/__pycache__').mkdir();(root/'deploy/__pycache__/x.cpython-312.pyc').write_bytes(b'cache')
        def symlinked_directory(root):(root/'deploy/yaml').symlink_to(root/'migrations',target_is_directory=True)
        def symlink(root):
            (root/'deploy/link.sql').symlink_to(root/'deploy/post-restore.sql')
        def listed_but_symlinked(root):
            (root/'deploy/pre-restore.sql').unlink();(root/'deploy/pre-restore.sql').symlink_to(root/'deploy/post-restore.sql')
        def digest(root):
            m=json.loads((root/'deploy/BUNDLE-MANIFEST.json').read_text());m['treeSha256']='0'*64;(root/'deploy/BUNDLE-MANIFEST.json').write_text(json.dumps(m))
        def swapped_manifest(root):
            # a consistent manifest for a changed file: the digest is recomputed from the hashes, so it agrees, but the file is not the one that the operator's digest names
            (root/'deploy/restore-plan.py').write_bytes(b'import os')
            m=json.loads((root/'deploy/BUNDLE-MANIFEST.json').read_text());m['files']['deploy/restore-plan.py']=hashlib.sha256(b'import os').hexdigest()
            m['treeSha256']=hashlib.sha256(json.dumps(m['files'],sort_keys=True,separators=(',',':')).encode()).hexdigest();(root/'deploy/BUNDLE-MANIFEST.json').write_text(json.dumps(m))
        for name,mutate in (('a listed file changed',tampered),('an unlisted file in deploy',unlisted_deploy),('an unlisted migration',unlisted_migration),('a symlink in deploy',symlink),
                            ('a listed file that is a symlink',listed_but_symlinked),('the digest of the manifest',digest),('an unlisted file at the top',unlisted_anywhere),
                            ('bytecode with no source',sourceless_bytecode),('a bytecode cache',bytecode_cache),('a symlinked directory',symlinked_directory)):
            with self.subTest(name=name),tempfile.TemporaryDirectory() as d:
                root=Path(d);self.make_bundle(root);mutate(root)
                r=self.run_checker(root);self.assertNotEqual(r.returncode,0);self.assertEqual(r.stdout,'')
        with self.subTest(name='a restore or preflight file that the manifest does not list'),tempfile.TemporaryDirectory() as d:
            root=Path(d);self.make_bundle(root,skip=('deploy/pre-restore.sql',))
            r=self.run_checker(root);self.assertNotEqual(r.returncode,0)
        with self.subTest(name='deploy/preflight.py missing from manifest'),tempfile.TemporaryDirectory() as d:
            root=Path(d);self.make_bundle(root,skip=('deploy/preflight.py',))
            r=self.run_checker(root);self.assertNotEqual(r.returncode,0)
        with self.subTest(name='a consistent manifest for a changed file passes the checker, and is what the digest of the release is for'),tempfile.TemporaryDirectory() as d:
            root=Path(d);before=self.make_bundle(root);swapped_manifest(root)
            r=self.run_checker(root);self.assertEqual(r.returncode,0);self.assertNotEqual(r.stdout.strip(),before['treeSha256'])
    def test_u6e_no_script_of_the_bundle_is_run_with_the_directory_of_the_script_on_its_path(self):
        # provision-server.py is older than N4 and needs PyYAML from wherever python3 finds it; it runs from the root-owned copy
        for l in self.shell_lines():
            if 'python3 ' in l and 'provision-server.py' not in l:self.assertIn('python3 -I',l)
    def test_u6f_what_a_failing_command_substitution_would_leave_empty_stops_the_install(self):
        text='\n'.join(self.shell_lines())
        # each value is read into a variable of its own, where set -e sees the failure, and is checked before it is used
        for pattern in (r'tables_sql=\$\(python3 -I "\$snap/deploy/restore-plan\.py" --tables-sql\)',r'restore_args=\$\(python3 -I "\$snap/deploy/restore-plan\.py" --pg-restore-args\)',
                        r'\[\[ -n "\$tables_sql" && -n "\$tables" \]\]',r'read -ra restore_args'):
            self.assertRegex(text,pattern)
        for flag in ('--exit-on-error','--single-transaction','--data-only','--no-owner','--disable-triggers'):self.assertIn(flag,text)
        self.assertNotRegex(text,r'pg_restore \$\(')
    def test_u6g_the_message_of_the_load_is_not_shown_and_the_copy_does_not_outlive_a_restore_that_passed(self):
        text='\n'.join(self.shell_lines())
        self.assertIn('2> "$work/restore.err"',text)
        self.assertNotRegex(text,r'echo [^\n]*\$\(cat[^\n]*restore\.err')
        self.assertLess(text.index('post_restore'),text.rindex('rm -f "$held"'))
        self.assertIn('/root/.libetech-restore.',text)
        self.assertIn('a.get("thread_order")=="checked"',text)
    # OQ-59 (b) (1): the root installer reads the count of revisions that have no number out of the answer, as install-user.py does: it passes an answer that carries the counts, and says how many threads
    # are held. It does not judge the kind of the archive: the file is told the kind (`SET libetech.archive_kind`, the word that restore-plan.py printed) and refuses an archive of before 023 that is still
    # without numbers (05): one rule, in one place. The reader is part of the reviewed script, run with python3 -I, and prints counts only.
    @staticmethod
    def answer_reader():
        text=(DEPLOY/'install-d1.sh').read_text();marker="<<'PY'\n"
        start=text.index(marker,text.index(marker)+1)+len(marker)  # the second heredoc of the script; the first is the bundle checker
        return text[start:text.index('\nPY\n',start)]
    def read_answer(self,answer,kind='post-023'):
        return subprocess.run([sys.executable,'-I','-',kind,answer],input=self.answer_reader(),text=True,capture_output=True)
    OK_ANSWER={'post_restore':'pass','thread_order':'checked','archive_kind':'post-023','held_by_project':[]}
    def test_u12_the_root_installer_passes_an_answer_with_nothing_held_and_prints_nothing(self):
        r=self.read_answer(json.dumps(self.OK_ANSWER));self.assertEqual((r.returncode,r.stdout,r.stderr),(0,'',''))
    HELD_PROJECTS=[{'project_no':1,'revisions':3,'threads':2},{'project_no':2,'revisions':1,'threads':1}]
    def test_u12_the_root_installer_passes_an_archive_that_held_threads_at_its_source_and_says_how_many_per_project_in_counts_only(self):
        r=self.read_answer(json.dumps({**self.OK_ANSWER,'held_by_project':self.HELD_PROJECTS,**self.STRAY}))
        self.assertEqual((r.returncode,r.stderr),(0,''))
        for fragment in ('project 1: 3 revision(s) in 2 thread(s)','project 2: 1 revision(s) in 1 thread(s)','OQ-59','RUNBOOK-RESTORE-AFTER-023'):self.assertIn(fragment,r.stdout)
        for leaked in ('chat','project_no','-100','{','stray-chat-value','stray-thread-value'):self.assertNotIn(leaked,r.stdout)
        self.assertNotRegex(r.stdout,r'\b4 revision|\b3 thread','no total over the projects')
        self.assertEqual(r.stdout,'\n'.join(installer.held_lines(self.HELD_PROJECTS))+'\n','the two installers say the same words')
    def run_shell_block(self,post,kind='post-023'):
        """The lines of install-d1.sh that read the answer, from the variable `answer` to the echo of the report, run by bash under set -euo pipefail with `post` (what psql printed) and `kind` as the script
        has them, then a line that only a script that went on would print."""
        text=(DEPLOY/'install-d1.sh').read_text();last='[[ -z "$report" ]] || echo "$report"'
        script='set -euo pipefail\npost="$1"; kind="$2"\n'+text[text.index('answer=$(printf'):text.index(last)+len(last)]+'\necho CONTINUED\n'
        return subprocess.run(['bash','-c',script,'bash',post,kind],capture_output=True,text=True)
    def test_u12_the_shell_stops_where_the_reader_says_stop_and_goes_on_where_it_says_go(self):
        ok=json.dumps(self.OK_ANSWER);held=json.dumps({**self.OK_ANSWER,'held_by_project':self.HELD_PROJECTS,**self.STRAY})
        r=self.run_shell_block(ok);self.assertEqual((r.returncode,r.stdout,r.stderr),(0,'CONTINUED\n',''))
        # what psql printed before its last line (a notice that reached stdout, an empty line) does not matter: the answer is the last line
        r=self.run_shell_block('NOTICE: something\n'+held);self.assertEqual((r.returncode,r.stderr),(0,''))
        self.assertEqual(r.stdout,'\n'.join(installer.held_lines(self.HELD_PROJECTS))+'\nCONTINUED\n')
        for label,post in (('no answer line',''),('not json','not json'),('a check that did not pass',json.dumps({**self.OK_ANSWER,'post_restore':'fail'})),
                           ('no count',json.dumps({k:v for k,v in self.OK_ANSWER.items() if k!='held_by_project'})),('another kind than the one it was told',json.dumps({**self.OK_ANSWER,'archive_kind':'pre-023'}))):
            with self.subTest(label=label):
                r=self.run_shell_block(post)
                self.assertEqual(r.returncode,1);self.assertNotIn('CONTINUED',r.stdout);self.assertIn('The post-restore check did not pass; nothing was started.',r.stderr)
    def test_u12_the_root_installer_does_not_take_what_it_cannot_read_for_a_pass(self):
        ok=self.OK_ANSWER
        cases={'not json':'not json','a list':'[1]','post_restore fail':json.dumps({**ok,'post_restore':'fail'}),'023 not applied':json.dumps({**ok,'thread_order':'023 not applied'}),
               'empty':'','another kind':json.dumps({**ok,'archive_kind':'pre-023'}),'no kind':json.dumps({k:v for k,v in ok.items() if k!='archive_kind'}),
               'kind of another case':json.dumps({**ok,'archive_kind':'POST-023'})}
        for label,value in self.BAD_HELD:
            cases['counts: '+label]=json.dumps({k:v for k,v in ok.items() if k!='held_by_project'} if label=='no key at all' else {**ok,'held_by_project':value})
        for label,text in cases.items():
            with self.subTest(label=label):
                r=self.read_answer(text);self.assertNotEqual(r.returncode,0);self.assertEqual(r.stdout,'')
        # and the kind that the script hands over is itself one of the two words (an unexpected word with a matching echo is not a pass)
        for kind in ('','other','post-023 '):
            with self.subTest(kind=kind):
                r=self.read_answer(json.dumps({**ok,'archive_kind':kind}),kind);self.assertNotEqual(r.returncode,0);self.assertEqual(r.stdout,'')
    def test_u12_the_root_installer_hands_the_reader_the_last_line_of_the_answer_and_stops_the_install_when_it_fails(self):
        lines=self.shell_lines();text='\n'.join(lines)
        self.assertRegex(text,r'answer=\$\(printf \'%s\\n\' "\$post" \| tail -n 1\)')
        self.assertRegex(text,r'report=\$\(python3 -I - "\$kind" "\$answer" <<\'PY\'')
        self.assertIn('The post-restore check did not pass; nothing was started.',text)
        self.assertIn('[[ -z "$report" ]] || echo "$report"',text,'what the reader says is shown, not dropped')
        at=lambda needle:next(i for i,l in enumerate(lines) if needle in l)
        self.assertLess(at('report=$(python3'),at('echo "$report"'))
        self.assertLess(at('< "$snap/deploy/post-restore.sql"'),at('answer=$(printf'));self.assertLess(at('answer=$(printf'),at('rm -f "$held" "$work/restore.err"'))
    def test_u12_the_shell_guard_of_the_kind_lets_two_words_through_and_stops_the_install_for_any_other(self):
        guard=next(l for l in self.shell_lines() if l.startswith('[[ "$kind" == post-023'))
        for kind,passes in (('post-023',True),('pre-023',True),('',False),('other',False),('post-023 ',False),(' pre-023',False),('PRE-023',False),('post-0*',False),("post-023'; id; '",False),('post-023\n',False)):
            with self.subTest(kind=kind):
                r=subprocess.run(['bash','-c','set -euo pipefail\nkind="$1"\n'+guard+'\necho CONTINUED\n','bash',kind],capture_output=True,text=True)
                self.assertEqual((r.returncode,r.stdout),(0,'CONTINUED\n') if passes else (1,''),r.stderr)
                if not passes:self.assertIn('nothing was loaded',r.stderr)
    def test_u12_the_root_installer_names_the_kind_of_the_archive_to_the_check_and_only_one_of_the_two_words(self):
        lines=self.shell_lines();text='\n'.join(lines)
        at=lambda needle:next(i for i,l in enumerate(lines) if needle in l)
        # the word is read from the plan, is one of the two that the file knows before it reaches a command line, and is handed to the file first (the file requires it: POST-RESTORE-01)
        self.assertRegex(text,r'\[\[ "\$kind" == post-023 \|\| "\$kind" == pre-023 \]\]')
        self.assertLess(at('kind=$(runuser'),at('[[ "$kind" == post-023'));self.assertLess(at('[[ "$kind" == post-023'),at('< "$snap/deploy/pre-restore.sql"'))
        post=lines[at('< "$snap/deploy/post-restore.sql"')]
        self.assertIn("-c \"SET libetech.archive_kind = '$kind'\"",post);self.assertIn('-f -',post)

class ArchiveIntegrity(unittest.TestCase):
    """D8 (security gate of the plan): the archive is loaded with the rights of a superuser and every guard of the database off, so it is read once, from a private copy, against the
    SHA-256 that the operator recorded when it was made. Integrity, not identity: the value comes from the operator, never from beside the archive."""
    GOOD='a'*64
    def setUp(self):
        self.saved=(installer.BASE,dict(installer.os.environ));self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        (self.root/'state').mkdir();installer.BASE=self.root
    def tearDown(self):
        installer.BASE=self.saved[0];installer.os.environ.clear();installer.os.environ.update(self.saved[1]);self.tmp.cleanup()
    def archive(self,payload=b'data-only archive bytes'):
        p=self.root/'in.dump';p.write_bytes(payload);return p,hashlib.sha256(payload).hexdigest()
    def test_u7_the_hash_must_be_given_and_must_look_like_one(self):
        for value in (None,'','abc','g'*64,'a'*63,'a'*65):
            with self.subTest(value=value):
                installer.os.environ.pop('LIBETECH_ARCHIVE_SHA256',None)
                if value is not None:installer.os.environ['LIBETECH_ARCHIVE_SHA256']=value
                with self.assertRaisesRegex(RuntimeError,'LIBETECH_ARCHIVE_SHA256') as caught:installer.expected_archive_hash()
                self.assertNotIn('g'*10,str(caught.exception))
    def test_u7_the_hash_is_taken_in_lower_case_and_without_blanks(self):
        installer.os.environ['LIBETECH_ARCHIVE_SHA256']=' '+('AB'*32)+'\n'
        self.assertEqual(installer.expected_archive_hash(),'ab'*32)
    def test_u7_a_matching_archive_is_copied_privately_and_the_copy_is_what_is_returned(self):
        source,digest=self.archive()
        held=installer.hold_archive(source,digest)
        self.assertEqual(held,self.root/'state/archive.dump');self.assertEqual(held.read_bytes(),source.read_bytes())
        self.assertEqual(stat_mode(held),0o600)
        source.write_bytes(b'changed after the copy');self.assertEqual(held.read_bytes(),b'data-only archive bytes')
    def test_u7_an_archive_that_does_not_match_is_refused_and_the_message_holds_no_hash(self):
        source,digest=self.archive()
        with self.assertRaises(RuntimeError) as caught:installer.hold_archive(source,self.GOOD)
        self.assertIn('was not loaded',str(caught.exception));self.assertNotIn(self.GOOD,str(caught.exception));self.assertNotIn(digest,str(caught.exception))
    def test_u7_an_existing_copy_is_never_overwritten(self):
        source,digest=self.archive();installer.hold_archive(source,digest)
        with self.assertRaises(FileExistsError):installer.hold_archive(source,digest)
    def test_u7_a_copy_that_does_not_match_is_removed_and_a_missing_original_leaves_nothing(self):
        source,digest=self.archive()
        with self.assertRaises(RuntimeError):installer.hold_archive(source,self.GOOD)
        self.assertFalse((self.root/'state/archive.dump').exists(),'the unverified copy does not stay')
        with self.assertRaises(FileNotFoundError):installer.hold_archive(self.root/'absent.dump',digest)
        self.assertFalse((self.root/'state/archive.dump').exists(),'no empty copy is left for the next try to trip on')
    def test_u7_the_archive_is_hashed_before_anything_is_created_and_held_before_any_receipt_is_written(self):
        source=(DEPLOY/'install-user.py').read_text()
        main=source[source.index('def main'):source.index('def run_pre_restore') if source.index('def run_pre_restore')>source.index('def main') else len(source)]
        main=main[:main.index('def ',10)] if 'def ' in main[10:] else main
        order=[main.index(n) for n in ('expected_archive_hash()','inspect(bundle,dump,chats)','archive_digest(dump)',"print(json.dumps({'preflight'",'BASE.mkdir','hold_archive(dump,expected)',"exclusive(BASE/'installation.json'")]
        self.assertEqual(order,sorted(order))
        self.assertNotIn('read_bytes()',main.split('hold_archive(')[1].split("exclusive(BASE/'package-hashes.json'")[0].split('shutil.copytree')[0])
        finish=source[source.index('def finish_install'):source.index('def resume_empty_database')]
        self.assertNotIn('hold_archive(',finish)
    def test_u7_recovery_holds_the_archive_and_records_the_hash_the_operator_gave(self):
        source=(DEPLOY/'install-user.py').read_text();resume=source[source.index('def resume_empty_database'):]
        self.assertLess(resume.index('hold_archive(dump,expected)'),resume.index('--list'))
        self.assertIn("'archiveHash':expected",resume);self.assertNotIn('read_bytes()',resume)
    def test_u9_a_file_that_runs_as_a_superuser_must_be_in_the_manifest(self):
        files={n:'0'*64 for n in installer.RESTORE_FILES}
        installer.require_restore_files({'files':files})
        for name in installer.RESTORE_FILES:
            with self.subTest(name=name):
                rest={k:v for k,v in files.items() if k!=name}
                with self.assertRaisesRegex(RuntimeError,'does not list '+re.escape(name)):installer.require_restore_files({'files':rest})
    def test_u9_the_migrations_that_will_be_applied_are_exactly_the_listed_ones(self):
        (self.root/'migrations').mkdir();(self.root/'migrations/001_a.sql').write_text('x');(self.root/'migrations/023_thread_order.sql').write_text('x')
        files={n:'0'*64 for n in installer.RESTORE_FILES};files['migrations/001_a.sql']='0'*64;files['migrations/rollback/023_thread_order.sql']='0'*64
        installer.require_restore_files({'files':files},self.root)
        (self.root/'migrations/024_unlisted.sql').write_text('x')
        with self.assertRaisesRegex(RuntimeError,'migrations of the bundle'):installer.require_restore_files({'files':files},self.root)
    def test_u9_inspection_demands_it_and_loads_the_plan_only_after_the_bundle_is_verified(self):
        source=(DEPLOY/'install-user.py').read_text();inspect=source[source.index('def inspect'):source.index('def main')]
        order=[inspect.index(n) for n in ('verify_bundle(bundle)','require_restore_files(manifest,bundle)','load_restore_plan(manifest)')]
        self.assertEqual(order,sorted(order))
        # nothing runs the plan when the installer is imported
        head=source[:source.index('SCOPE=json.loads(')]
        self.assertNotIn('exec_module',head);self.assertNotIn('restore_plan=load_restore_plan()',source)
    def test_u9_the_plan_that_runs_is_the_file_that_the_manifest_lists(self):
        data=(DEPLOY/'restore-plan.py').read_bytes()
        good={'files':{'deploy/restore-plan.py':hashlib.sha256(data).hexdigest()}}
        saved=installer._RESTORE_PLAN
        try:
            self.assertTrue(hasattr(installer.load_restore_plan(good),'classify_archive'))
            for manifest in ({'files':{}},{'files':{'deploy/restore-plan.py':'0'*64}}):
                with self.assertRaisesRegex(RuntimeError,'not the file that the bundle manifest lists'):installer.load_restore_plan(manifest)
        finally:installer._RESTORE_PLAN=saved

def stat_mode(path):
    import stat as _stat
    return _stat.S_IMODE(path.stat().st_mode)

class PostRestoreRunner(unittest.TestCase):
    """D5: the installer shows the codes of deploy/post-restore.sql and nothing else of what psql says (the repository is public, and a PostgreSQL message can quote a row)."""
    def fake(self,code,out,err):
        saved=installer.subprocess.run
        installer.subprocess.run=lambda *a,**k:subprocess.CompletedProcess(a[0],code,out,err)
        self.addCleanup(lambda:setattr(installer.subprocess,'run',saved))
    def test_u8_a_refusal_is_reported_by_its_code_only(self):
        # (POST-RESTORE-05 is no longer a refusal: a revision without a number is counted in the answer, OQ-59 (b) (1))
        self.fake(3,'','psql:post-restore.sql:1: ERROR:  POST-RESTORE-06 3 counter row(s) disagree with the numbers of their thread\nDETAIL:  Key (chat_id)=(-10012345) is not present\nCONTEXT:  PL/pgSQL function')
        with self.assertRaises(RuntimeError) as caught:installer.run_post_restore([Path('/pg/bin/psql')],{},'-- sql','post-023')
        self.assertIn('POST-RESTORE-06',str(caught.exception))
        for leaked in ('10012345','chat_id','counter row(s)','DETAIL'):self.assertNotIn(leaked,str(caught.exception))
    def test_u8_an_exit_code_of_zero_without_the_answer_line_is_a_failure(self):
        for out in ('','not json\n','{"post_restore" : "fail"}\n'):
            with self.subTest(out=out):
                self.fake(0,out,'')
                with self.assertRaises(RuntimeError):installer.run_post_restore([Path('/pg/bin/psql')],{},'-- sql','post-023')
    def test_u8_the_answer_line_after_the_notices_is_the_result(self):
        self.fake(0,'{"post_restore" : "pass", "numbering_trigger_was" : "O"}\n','psql:x:1: NOTICE:  POST-RESTORE-00 the numbering trigger stood at O')
        self.assertEqual(installer.run_post_restore([Path('/pg/bin/psql')],{},'-- sql','post-023')['numbering_trigger_was'],'O')
    def test_u8_a_refusal_of_the_check_before_the_load_is_reported_by_its_code_only(self):
        self.fake(3,'','psql:pre-restore.sql:1: ERROR:  PRE-RESTORE-02 17 table(s) of the target already hold rows\nDETAIL:  Key (chat_id)=(-10012345)')
        with self.assertRaises(RuntimeError) as caught:installer.run_pre_restore([Path('/pg/bin/psql')],{},'-- sql')
        self.assertIn('PRE-RESTORE-02',str(caught.exception))
        for leaked in ('10012345','chat_id','table(s)','DETAIL'):self.assertNotIn(leaked,str(caught.exception))
        self.fake(0,'','');installer.run_pre_restore([Path('/pg/bin/psql')],{},'-- sql')
    def test_u8_a_kind_that_is_not_one_of_the_two_words_is_refused_before_psql_is_run(self):
        ran=[]
        saved=installer.subprocess.run
        installer.subprocess.run=lambda *a,**k:ran.append(a) or subprocess.CompletedProcess(a[0],0,'{"post_restore" : "pass"}\n','')
        self.addCleanup(lambda:setattr(installer.subprocess,'run',saved))
        for kind in ('',"post-023'; DROP SCHEMA public; --",'POST-023','other',None):
            with self.subTest(kind=kind),self.assertRaises(RuntimeError):installer.run_post_restore([Path('/pg/bin/psql')],{},'-- sql',kind)
        self.assertEqual(ran,[])
    def test_u8_what_the_installer_asks_psql_for(self):
        seen=[]
        saved=installer.subprocess.run
        def capture(args,**kw):seen.append((args,kw));return subprocess.CompletedProcess(args,0,'{"post_restore" : "pass"}\n','')
        installer.subprocess.run=capture;self.addCleanup(lambda:setattr(installer.subprocess,'run',saved))
        installer.run_post_restore([Path('/pg/bin/psql'),'-X','-q','-v','ON_ERROR_STOP=1'],{},'-- the file','pre-023')
        args,kw=seen[0]
        self.assertIn('ON_ERROR_STOP=1',args);self.assertIn('-At',args);self.assertEqual(kw['input'],'-- the file');self.assertTrue(kw['capture_output'])
        # the kind of the archive goes in first, in the same session as the file (psql runs -c and -f in the order given), and the file is read from stdin
        self.assertEqual(args[args.index('-c'):args.index('-c')+4],['-c',"SET libetech.archive_kind = 'pre-023'",'-f','-'])
        # PostgreSQL's own messages carry DETAIL and CONTEXT, which can quote a row of the data
        for setting in ('VERBOSITY=terse','SHOW_CONTEXT=never'):self.assertIn(setting,args)

if __name__=='__main__':unittest.main()
