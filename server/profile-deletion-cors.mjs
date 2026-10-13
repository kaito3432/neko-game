// DELETE is exposed only for authenticated self-deletion, never for all APIs.
const ORIGINS=new Set(['capacitor://localhost','https://localhost','http://localhost','https://kaito3432.github.io']);
export async function profileDeletionCors(request,forward){
  const path=new URL(request.url).pathname,method=request.method;
  const preflight=method==='OPTIONS'&&request.headers.get('access-control-request-method')==='DELETE';
  if(method!=='DELETE'&&!preflight)return null;
  if(path!=='/api/online/profile')return Response.json({error:'method_not_allowed'},{status:405});
  const origin=request.headers.get('origin');
  if(origin&&!ORIGINS.has(origin))return Response.json({error:'origin_not_allowed'},{status:403});
  const headers=new Headers({'vary':'Origin','cache-control':'no-store'});
  if(origin)headers.set('access-control-allow-origin',origin);
  if(preflight){
    const requested=(request.headers.get('access-control-request-headers')||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    if(requested.some(x=>!['authorization','content-type'].includes(x)))
      return Response.json({error:'headers_not_allowed'},{status:403});
    headers.set('access-control-allow-methods','DELETE, OPTIONS');
    headers.set('access-control-allow-headers','Authorization, Content-Type');
    return new Response(null,{status:204,headers});
  }
  headers.set('content-type','application/json; charset=UTF-8');
  if(!/^Bearer [a-f0-9]{64}$/.test(request.headers.get('authorization')||''))
    return new Response(JSON.stringify({error:'unauthorized'}),{status:401,headers});
  const response=await forward(request);
  return new Response(response.body,{status:response.status,headers});
}
