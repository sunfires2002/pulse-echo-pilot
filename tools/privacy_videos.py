"""LAB read-time conversion and value-free administrator counts.
The database equivalent is privacy_lab_youtube_id(jsonb); no offset is applied.
"""
import json,re
from pathlib import Path
FIELDS=('firstHalfVideo','secondHalfVideo','highlightVideo')
PUBLIC_FIELDS=('id','date','competition','round','home','away','homeScore','awayScore',*FIELDS,'published')
ID=re.compile(r'[A-Za-z0-9_-]{11}')
SHORT=re.compile(r'https://(?:www\.)?youtu\.be/([A-Za-z0-9_-]{11})(?:\?[^\s#]*)?(?:#[^\s]*)?')
def video_id(value):
    if not isinstance(value,str):return None
    value=value.strip(' ')
    if len(value)>2048:return None
    if ID.fullmatch(value):return value
    match=SHORT.fullmatch(value)
    return match[1] if match else None

def is_empty(value):
    return value is None or isinstance(value,str) and value.strip(' ')==''

def report(rows):
    by_field=[]
    for field in FIELDS:
        empty=sum(is_empty(row.get(field)) for row in rows)
        converted=sum(not is_empty(row.get(field)) and video_id(row.get(field)) is not None for row in rows)
        by_field.append({'video_field':field,'total':len(rows),'empty':empty,'converted':converted,'invalid':len(rows)-empty-converted})
    invalid=sum(r['invalid'] for r in by_field)
    return {'by_field':by_field,'invalid_total':invalid,'status':'INVALID_VIDEO_FORMATS_REQUIRE_REVIEW' if invalid else 'OK'}

def public_rows(rows):
    return [{k:video_id(row.get(k)) if k in FIELDS else row.get(k) for k in PUBLIC_FIELDS} for row in rows if row.get('published') is True]

if __name__=='__main__':
    rows=json.loads((Path(__file__).parent/'privacy-fixtures.json').read_text())
    print(json.dumps(report(rows)))
