import json,glob,os,re,collections
RV=os.path.expanduser('~/cf-canary/books/the-autobiography-of-benjamin-franklin/reviews')
panels=['06d7596a','87c9dc3c','37df51a2','ec0e30a8','4a2acca7','8aeae974','5ebfffd3','1720d489','9827ee52','585058c1','1ca523b6','052e2b67','ba9e7444','35abdd05']
files={}
for p in glob.glob(RV+'/*.json'):
  d=json.load(open(p)); rid=d['reviewId']
  for k in panels:
    if k in rid.replace('review-','')[:12] or os.path.basename(p).startswith('review-'+k): files[k]=(p,d)
def norm(u): return re.sub(r'[^a-z0-9]+',' ',u.lower()).strip()
for i,k in enumerate(panels,1):
  if k not in files: print('P%d'%i,k,'MISSING'); continue
  p,d=files[k]
  bl=[x for x in d['issues'] if x['severity']=='BLOCKER' and x['code'].startswith('READER.BLOCKING')]
  cc=collections.defaultdict(set); uu=collections.defaultdict(set); ch=collections.defaultdict(set)
  seats=collections.Counter()
  for x in bl:
    loc=x.get('location','')
    parts=loc.split('/',2)
    if len(parts)<3: continue
    c,seat,unit=parts; seats[seat]+=1
    cc[(c,x['code'])].add(seat); uu[(c,norm(unit))].add(seat); ch[c].add(seat)
  a=sum(1 for v in cc.values() if len(v)>=2); b=sum(1 for v in uu.values() if len(v)>=2); c2=sum(1 for v in ch.values() if len(v)>=2)
  print('P%-2d %s out=%s blockers=%d seats=%s ch+cat>=2:%d unit>=2:%d chapter>=2:%d'%(i,k,d['outcome'],len(bl),dict(seats),a,b,c2))
