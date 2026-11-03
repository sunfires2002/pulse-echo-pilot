"""Offline tests only. All credentials/users are deliberately fictional."""
import base64
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import pty
import select
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import admin_password_once as tool
REF = 'a' * 20
ADMIN = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'
CFG = {'supabaseUrl':'https://' + REF + '.supabase.co', 'testProjectRef':REF,
       'publishableKey':'sb_publishable_FAKE_LOCAL_ONLY', 'adminUserId':ADMIN}
PW = 'FICTIONAL-password-ONLY-123'

def key(ref=REF, role='service_role', exp=4102444800):
    encode = lambda data: base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')
    return encode({'alg':'HS256','typ':'JWT'}) + '.' + encode({'iss':'supabase','ref':ref,'role':role,'exp':exp}) + '.' + 'F' * 43

class FakeAuth:
    def __init__(self, cfg, secret):
        self.allowed_ids = set()
        self.calls = []
        self.users = {ADMIN:{'id':ADMIN,'email':'admin@lab.invalid','email_confirmed_at':'2026-01-01'},
                      OTHER:{'id':OTHER,'email':'other@lab.invalid','email_confirmed_at':'2026-01-01'}}
    def allow_users(self, ids): self.allowed_ids = set(ids)
    def request(self, method, uid, payload=None):
        assert uid in self.allowed_ids and method in ('GET','PUT')
        self.calls.append((method,uid,copy.deepcopy(payload)))
        if method == 'PUT': assert payload == {'password':PW}
        return copy.deepcopy(self.users[uid])

class Tests(unittest.TestCase):
    def setUp(self):
        self.pin = patch.object(tool, 'TEST_REF_SHA256', hashlib.sha256(REF.encode()).hexdigest())
        self.pin.start()
        self.network = patch.object(tool.http.client, 'HTTPSConnection', side_effect=AssertionError('REAL NETWORK FORBIDDEN'))
        self.network.start()
        self.messages=[]
        self.secret_values=[key(),ADMIN,'admin@lab.invalid',PW,PW,OTHER,'other@lab.invalid',PW,PW]
        self.answers=[tool.PROJECT_NAME,REF,'CHECKED_OFF','VERIFY_EXISTING_USERS','UPDATE_ADMINISTRATOR','UPDATE_NON_ADMINISTRATOR']
        self.fake=FakeAuth(CFG,key())
    def tearDown(self):
        self.network.stop();self.pin.stop()
    def run_tool(self,execute=True,api=None):
        secrets=iter(self.secret_values);answers=iter(self.answers)
        return tool.run(CFG,lambda _:next(secrets),lambda _:next(answers),self.messages.append,
                        execute=execute,transport_factory=lambda *_:api or self.fake)
    def assert_safe_output(self):
        text='\n'.join(self.messages)
        for private in [key(),PW,ADMIN,OTHER,'admin@lab.invalid','other@lab.invalid','PRIVATE_PROVIDER_BODY']:
            self.assertNotIn(private,text)
    def test_input_only_no_api(self):
        self.assertEqual(self.run_tool(execute=False),0);self.assertEqual(self.fake.calls,[]);self.assert_safe_output()
    def test_success_two_existing_users_only(self):
        self.assertEqual(self.run_tool(),0)
        self.assertEqual([(m,u) for m,u,_ in self.fake.calls], [('GET',ADMIN),('GET',OTHER),('GET',ADMIN),('PUT',ADMIN),('GET',ADMIN),('GET',OTHER),('PUT',OTHER),('GET',OTHER)])
        self.assert_safe_output()
    def test_production_and_other_projects_rejected(self):
        for ref in [tool.production_host().split('.')[0], 'b'*20]:
            cfg={**CFG,'testProjectRef':ref,'supabaseUrl':'https://'+ref+'.supabase.co'}
            with self.assertRaises(tool.Stopped): tool.checked_config(cfg)
        for field,value in [('supabaseUrl',CFG['supabaseUrl']+'@evil.invalid'),('supabaseUrl',CFG['supabaseUrl']+'/?x=1'),('adminUserId','bad')]:
            with self.assertRaises(tool.Stopped):tool.checked_config({**CFG,field:value})
    def test_key_guards(self):
        for value in [key(tool.production_host().split('.')[0]),key('b'*20),key(role='anon'),key(exp=1),CFG['publishableKey'],'sb_secret_FAKE_OPAQUE_KEY','not.a.jwt',key()+'\n']:
            with self.assertRaises(tool.Stopped):tool.checked_key(value,CFG)
    def test_password_and_targets(self):
        for password,repeat in [('short','short'),(PW,'different'),('あ'*25,'あ'*25),(' '*12,' '*12),(PW+'\n',PW+'\n')]:
            with self.assertRaises(tool.Stopped):tool.checked_password(password,repeat)
        self.secret_values[5]=ADMIN
        self.assertEqual(self.run_tool(),1);self.assertEqual(self.fake.calls,[]);self.assert_safe_output()
    def test_both_identities_checked_before_any_update(self):
        self.fake.users[OTHER]['email']='wrong@lab.invalid'
        self.assertEqual(self.run_tool(),1);self.assertFalse(any(m=='PUT' for m,_,_ in self.fake.calls));self.assert_safe_output()
    def test_notification_gate_and_cancel(self):
        self.answers[2]='UNKNOWN';self.assertEqual(self.run_tool(),1);self.assertEqual(self.fake.calls,[])
        self.assertIn('NOTIFICATION_CHECK_REQUIRED','\n'.join(self.messages));self.assert_safe_output()
    def test_second_cancel_reports_first_changed(self):
        self.answers[-1]='CANCEL';self.assertEqual(self.run_tool(),1)
        self.assertEqual(sum(m=='PUT' for m,_,_ in self.fake.calls),1)
        self.assertIn('administrator=updated_uuid_matched','\n'.join(self.messages));self.assert_safe_output()
    def test_unknown_write_stops_without_retry(self):
        request=self.fake.request
        def fail(method,uid,payload=None):
            if method=='PUT':self.fake.calls.append((method,uid,None));raise TimeoutError('PRIVATE_PROVIDER_BODY '+key()+PW)
            return request(method,uid,payload)
        self.fake.request=fail
        self.assertEqual(self.run_tool(),1);self.assertEqual(sum(m=='PUT' for m,_,_ in self.fake.calls),1)
        self.assertIn('unknown_do_not_retry','\n'.join(self.messages));self.assert_safe_output()
    def test_bad_update_identity_is_not_success(self):
        request=self.fake.request
        def wrong(method,uid,payload=None):
            result=request(method,uid,payload)
            if method=='PUT':result['id']=OTHER
            return result
        self.fake.request=wrong
        self.assertEqual(self.run_tool(),1);self.assertIn('unknown_do_not_retry','\n'.join(self.messages));self.assert_safe_output()
    def test_prewrite_identity_recheck(self):
        request=self.fake.request
        def changed(method,uid,payload=None):
            result=request(method,uid,payload)
            if len(self.fake.calls)==3: result['email']='changed@lab.invalid'
            return result
        self.fake.request=changed
        self.assertEqual(self.run_tool(),1);self.assertFalse(any(m=='PUT' for m,_,_ in self.fake.calls));self.assert_safe_output()
    def test_https_fixed_path_no_redirect_and_redaction(self):
        class Response:
            status=200
            def read(self,limit):return json.dumps({'id':ADMIN,'email':'admin@lab.invalid'}).encode()
        class Connection:
            calls=[]
            def __init__(self,host,**kwargs):self.calls.append(('host',host));self.response=Response();self.assert_tls=kwargs['context']
            def request(self,method,path,body=None,headers=None):self.calls.append((method,path,body,headers))
            def getresponse(self):return self.response
            def close(self):pass
        with patch.object(tool.http.client,'HTTPSConnection',Connection):
            api=tool.AuthOnlyTransport(CFG,key());api.allow_users([ADMIN,OTHER])
            api.request('GET',ADMIN);api.request('PUT',ADMIN,{'password':PW})
            self.assertEqual(Connection.calls[0],('host',REF+'.supabase.co'))
            self.assertEqual(Connection.calls[1][1],'/auth/v1/admin/users/'+ADMIN)
            for method,payload in [('DELETE',None),('POST',{}),('PUT',{'password':PW,'email':'new@lab.invalid'})]:
                with self.assertRaises(tool.Stopped):api.request(method,ADMIN,payload)
            Response.status=303
            with self.assertRaisesRegex(tool.Stopped,'AUTH_HTTP_303'):api.request('GET',ADMIN)
            Response.status=403
            with self.assertRaisesRegex(tool.Stopped,'AUTH_HTTP_403'):api.request('GET',ADMIN)
            # No redirected request or error-response body read occurs.
    def test_unknown_arguments_do_not_echo_values(self):
        completed=subprocess.run([sys.executable,'-B',str(ROOT/'tools/admin_password_once.py'),'--password',PW],capture_output=True,text=True)
        self.assertEqual(completed.returncode,2)
        self.assertNotIn(PW,completed.stdout+completed.stderr)
    def test_noninteractive_fails_closed(self):
        with patch.object(tool,'read_config',return_value=CFG),patch.object(sys,'argv',['tool','--execute']),patch('sys.stdin.isatty',return_value=False),patch('sys.stdout',new_callable=io.StringIO) as captured:
            self.assertEqual(tool.main(),1)
            self.assertNotIn(key(),captured.getvalue())
    def test_real_tty_hides_inputs_no_network(self):
        # A child attached to a real pseudo-terminal exercises getpass echo-off.
        code="import sys,hashlib;sys.path.insert(0,'tools');import admin_password_once as t;t.TEST_REF_SHA256=hashlib.sha256(('a'*20).encode()).hexdigest();t.read_config=lambda:"+repr(CFG)+";sys.argv=['tool','--check-inputs'];sys.exit(t.main())"
        master,slave=pty.openpty()
        process=subprocess.Popen([sys.executable,'-B','-c',code],cwd=ROOT,stdin=slave,stdout=slave,stderr=slave,start_new_session=True)
        import os
        os.close(slave);output=b'';pending=b'';values=[tool.PROJECT_NAME,REF,'CHECKED_OFF']+self.secret_values;index=0
        deadline=time.monotonic()+12
        try:
            while time.monotonic()<deadline:
                ready,_,_=select.select([master],[],[],.1)
                if ready:
                    try:chunk=os.read(master,65536)
                    except OSError:break
                    if not chunk:break
                    output+=chunk;pending+=chunk
                    if pending.rstrip().endswith(b':') and index<len(values):
                        os.write(master,(values[index]+'\n').encode());index+=1;pending=b''
                if process.poll() is not None:break
            process.wait(timeout=2)
            self.assertEqual(process.returncode,0)
            for value in self.secret_values:self.assertNotIn(value.encode(),output)
            self.assertIn(b'No connection, authentication, email or user update attempted',output)
        finally:
            if process.poll() is None:process.kill();process.wait()
            os.close(master)

if __name__=='__main__':
    unittest.main(verbosity=2)
