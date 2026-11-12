"""Regression guards for restoring a data archive into an existing schema."""
import hashlib,importlib.util,json,re,sys,tempfile,unittest
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
        for mutation in ('apt-get','useradd','install -d','cp -a','pg_createcluster','pg_restore'):
            self.assertLess(preflight,at(mutation),mutation)
        provision=(Path(__file__).resolve().parents[1]/'deploy/provision-server.py').read_text()
        self.assertLess(provision.index('check_recipient('),provision.index("save(state/'bridge.json'"))
    def test_repository_scope_has_no_chat_ids(self):
        text=(Path(__file__).resolve().parents[1]/'deploy/pilot-scope.json').read_text()
        scope=json.loads(text)
        self.assertNotIn('internalChatId',scope);self.assertNotIn('deniedChatIds',scope)
        self.assertIsNone(re.search(r'(?<![\w-])-\d{5,}',text))
if __name__=='__main__':unittest.main()
