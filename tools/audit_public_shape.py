"""Pure in-memory public projection audit. No connection, file output or row values."""
import datetime,re
from privacy_videos import video_id,is_empty,FIELDS
KEYS=('id','date','competition','round','home','away','homeScore','awayScore',*FIELDS,'published')
def audit(rows):
    errors={};optional={};ids=set();counts={'rows':len(rows),'published':0,'unpublished':0,'videos_success':0,'videos_invalid':0,'nonempty_venue':0,'nonempty_description':0}
    def bad(k):errors[k]=errors.get(k,0)+1
    for row in rows:
        if not isinstance(row.get('id'),str) or not row['id']:bad('id')
        elif row['id'] in ids:bad('duplicate_id')
        else:ids.add(row['id'])
        if row.get('data_id')!=row.get('id'):bad('outer_inner_id_mismatch')
        if row.get('published') is True:counts['published']+=1
        elif row.get('published') is False:counts['unpublished']+=1
        else:bad('published_not_boolean')
        try:
            date=row.get('date');assert isinstance(date,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',date);datetime.date.fromisoformat(date)
        except (AssertionError,ValueError,TypeError):bad('date')
        for k in ('home','away'):
            if not isinstance(row.get(k),str) or not row[k]:bad(k)
        for k in ('competition','round'):
            v=row.get(k)
            if v is None or v=='':optional[k]=optional.get(k,0)+1
            elif not isinstance(v,str):bad(k)
        for k in ('homeScore','awayScore'):
            v=row.get(k)
            if v is None:optional[k]=optional.get(k,0)+1
            elif type(v) is not int or not 0<=v<=999:bad(k)
        for k in FIELDS:
            v=row.get(k)
            if not is_empty(v):counts['videos_success' if video_id(v) is not None else 'videos_invalid']+=1
        for k in ('venue','description'):
            if row.get(k) not in (None,''):counts['nonempty_'+k]+=1
    return {'counts':counts,'incompatible':errors,'optional_missing_or_empty':optional,'compatible':not errors and counts['videos_invalid']==0}
