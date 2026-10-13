// workerd adapter for Apple's library's node-fetch v2 import. No certificate
// or OCSP validation is changed: only transport and Response.buffer support.
import {Buffer} from 'node:buffer';
export const Headers=globalThis.Headers;
export const Request=globalThis.Request;
export const Response=globalThis.Response;
export default async function nodeFetch(url,options={}){
 const {timeout,signal,...init}=options;
 const signals=[signal,...(timeout?[AbortSignal.timeout(timeout)]:[])].filter(Boolean);
 const response=await globalThis.fetch(url,{...init,...(signals.length?{signal:AbortSignal.any(signals)}:{})});
 return {
  ok:response.ok,status:response.status,statusText:response.statusText,headers:response.headers,
  buffer:async()=>Buffer.from(await response.arrayBuffer()),
  json:()=>response.json(),text:()=>response.text(),arrayBuffer:()=>response.arrayBuffer()
 };
}
