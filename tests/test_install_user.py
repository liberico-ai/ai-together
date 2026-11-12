"""Regression guards for restoring a data archive into an existing schema."""
import hashlib,importlib.util,json,sys,tempfile,unittest
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
if __name__=='__main__':unittest.main()
