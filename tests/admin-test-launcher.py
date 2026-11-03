"""Launcher routing regression. All account values and processes are mocked."""
import io
from pathlib import Path
import runpy
import sys
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
CFG={'supabaseUrl':'https://'+'a'*20+'.supabase.co','testProjectRef':'a'*20,'publishableKey':'sb_publishable_FAKE_TEST','adminUserId':'00000000-0000-4000-8000-000000000001'}
class Output(io.StringIO):
    def isatty(self):return True
class Tests(unittest.TestCase):
    def launch(self,mode,cancel=False):
        answers=iter(['pulse-echo-security-lab','a'*20,'CANCEL' if cancel else 'TEST_MATCH_CRUD'] if mode=='--run' else ['a'*20])
        credentials=iter(['admin@lab.invalid','FAKE_ADMIN_PASSWORD','other@lab.invalid','FAKE_OTHER_PASSWORD'])
        captured={}
        def spawn(argv,**kwargs):captured.update(argv=argv,env=kwargs['env']);return type('Result',(),{'returncode':0})()
        with patch('admin_lab_settings.read_config',return_value=CFG),patch('admin_password_once.checked_config',side_effect=lambda c:c),patch('sys.argv',['launcher',mode]),patch('sys.stdin.isatty',return_value=True),patch('sys.stdout',new_callable=Output) as out,patch('sys.stderr',new_callable=Output),patch('builtins.input',side_effect=lambda _:next(answers)),patch('getpass.getpass',side_effect=lambda _:next(credentials)),patch('subprocess.run',side_effect=spawn):
            with self.assertRaises(SystemExit) as exit:runpy.run_path(str(ROOT/'tools/run-admin-security-lab-tests.py'),run_name='__main__')
            self.assertEqual(exit.exception.code,1 if cancel else 0)
            self.assertNotIn('FAKE_ADMIN_PASSWORD',out.getvalue())
        return captured
    def test_run_dispatches_rls(self):
        result=self.launch('--run');self.assertTrue(result['argv'][-1].endswith('admin-safety-rls.cjs'));self.assertEqual(result['env']['ADMIN_MATCH_WRITES_APPROVED'],'TEST_MATCH_CRUD')
    def test_diagnose_remains_auth_only(self):
        result=self.launch('--diagnose-auth');self.assertTrue(result['argv'][-1].endswith('admin-auth-diagnostic.cjs'));self.assertEqual(result['env']['ADMIN_MATCH_WRITES_APPROVED'],'')
    def test_cancel_never_launches(self):self.assertEqual(self.launch('--run',cancel=True),{})
if __name__=='__main__':unittest.main(verbosity=2)
