"""GET-only anonymous real-client audit against the pinned TEST project.
No authentication passwords, admin keys, database writes, or response contents are logged.
"""
import argparse,json,urllib.request,urllib.error
from public_privacy_config import read_config
p=argparse.ArgumentParser();p.add_argument('--config-file',required=True);a=p.parse_args()
try:c=read_config(a.config_file)
except (OSError,ValueError):raise SystemExit('TEST_CONFIG_REJECTED')
fields={'id','date','competition','round','home','away','homeScore','awayScore','firstHalfVideo','secondHalfVideo','highlightVideo','published'}
def get(path):
 req=urllib.request.Request(c['publicApiUrl']+path,headers={'apikey':c['publicApiKey'],'Accept':'application/json'},method='GET')
 try:
  with urllib.request.urlopen(req,timeout=20) as response:return response.status,json.load(response)
 except urllib.error.HTTPError as e:
  return e.code,None
 except Exception:raise RuntimeError('TEST_TRANSPORT_FAILED') from None
checks=[]
try:
 status,rows=get('/rest/v1/rpc/public_privacy_matches')
 assert status==200 and isinstance(rows,list) and len(rows)==2,'PUBLIC_RPC_FAILED'
 assert {r['id'] for r in rows}=={'privacy-sample-a','privacy-sample-b'},'UNEXPECTED_ROWS'
 assert all(set(r)==fields and r['published'] is True for r in rows),'PUBLIC_FIELDS_FAILED'
 assert 'PRIVATE_FIXTURE' not in json.dumps(rows),'INTERNAL_CONTENT_LEAK'
 checks.append('anonymous_public_only_allowlisted_fields')
 for ident in ('privacy-sample-hidden','privacy-sample-missing','does-not-exist'):
  status,rows=get('/rest/v1/rpc/public_privacy_matches?requested_id='+ident)
  assert status==200 and rows==[],'HIDDEN_OR_UNKNOWN_ID_LEAK'
 checks.append('unpublished_string_boolean_unknown_ids_hidden')
 status,rows=get('/rest/v1/privacy_lab_matches?select=*')
 assert status in (401,403),'ORIGINAL_ACCESS_NOT_DENIED'
 checks.append('anonymous_original_select_denied')
 status,rows=get('/rest/v1/rpc/public_privacy_matches?select=workflow')
 assert status in (400,404),'WORKFLOW_FIELD_ACCESS_NOT_DENIED'
 checks.append('workflow_not_in_rpc_schema')
 print(json.dumps({'passed':True,'checks':checks,'methods':['GET'],'writes':0,'production_connections':0}))
except (AssertionError,RuntimeError) as e:
 print(json.dumps({'passed':False,'error':str(e),'checks':checks,'methods':['GET'],'writes':0}));raise SystemExit(1)
