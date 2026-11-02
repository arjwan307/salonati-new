"""Anonymous GETs only; prints status/shape, never account data or response bodies."""
import concurrent.futures,json,time,urllib.request,urllib.error
roles=['customer','salon','cosmetics','admin']
cases=[(r,'/') for r in roles]+[(r,'/api/catalog/admin/bookings') for r in roles]+[('customer','/api/customer/approved-catalog'),('customer','/api/cosmetics/public')]
def check(case):
 role,path=case;started=time.monotonic();url=f'https://salonati-{role}-clean.pages.dev{path}'
 try:
  with urllib.request.urlopen(url,timeout=25) as response:
   body=response.read(2*1024*1024);kind=response.headers.get('content-type','');out={'role':role,'path':path,'status':response.status,'seconds':round(time.monotonic()-started,2),'content_type':kind}
   if 'json' in kind:
    data=json.loads(body);out['keys']=list(data);out['array_counts']={k:len(v) for k,v in data.items() if isinstance(v,list)}
   else:out['nonempty']=len(body)>0
   return out
 except urllib.error.HTTPError as e:return {'role':role,'path':path,'status':e.code}
 except Exception as e:return {'role':role,'path':path,'error':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(check,cases):print(json.dumps(result))
