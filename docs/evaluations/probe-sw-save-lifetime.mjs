// Trace each owned ServiceWorker realm, including restarts, without changing artifact bytes.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const trace = {scope:'CDP runtime instrumentation only; diagnostic observations, not product acceptance', events:[], errors:[]};
const tasks = [];
const originalLaunch = chromium.launch.bind(chromium);
const hook = `(() => {
  if(self.__saveTraceInstalled) return;
  self.__saveTraceInstalled = true;
  let sequence = 0;
  const send = data => {try {self.__saveTrace(JSON.stringify({time:Date.now(),workerUrl:self.location.href,...data}));} catch {}};
  send({kind:'realm-hook-installed'});
  const wait = ExtendableEvent.prototype.waitUntil;
  ExtendableEvent.prototype.waitUntil = function(promise) {
    const id = ++sequence;
    const result = wait.call(this,promise);
    send({kind:'wait-start',id,type:this.type,url:this.request?.url});
    Promise.resolve(promise).then(() => send({kind:'wait-settle',id}),error => send({kind:'wait-reject',id,error:String(error)}));
    return result;
  };
  const respond = FetchEvent.prototype.respondWith;
  FetchEvent.prototype.respondWith = function(response) {
    const id = ++sequence;
    const result = respond.call(this,response);
    const url = this.request.url;
    send({kind:'respond-start',id,url});
    Promise.resolve(response).then(value => send({kind:'respond-ready',id,url,status:value?.status,bodyUsed:value?.bodyUsed,bodyLocked:value?.body?.locked}),error => send({kind:'respond-reject',id,url,error:String(error)}));
    this.handled.then(() => send({kind:'respond-handled',id,url}),error => send({kind:'respond-handled-reject',id,url,error:String(error)}));
    return result;
  };
  const put = Cache.prototype.put;
  Cache.prototype.put = function(request,response) {
    const id = ++sequence;
    const promise = put.call(this,request,response);
    send({kind:'put-start',id,url:typeof request === 'string' ? request : request.url,length:response.headers.get('content-length')});
    promise.then(() => send({kind:'put-settle',id}),error => send({kind:'put-reject',id,error:String(error)}));
    return promise;
  };
  self.addEventListener('fetch',event => {
    const id = ++sequence;
    send({kind:'fetch-start',id,url:event.request.url});
    event.handled.then(() => send({kind:'fetch-handled',id}),error => send({kind:'fetch-handled-reject',id,error:String(error)}));
  });
  self.addEventListener('message',event => {
    if(event.data?.type === 'SKIP_WAITING') send({kind:'switch-received'});
  });
})();`;
chromium.launch = async options => {
  const browser = await originalLaunch(options);
  const cdp = await browser.newBrowserCDPSession();
  const sessions = new Map();
  const pending = new Map();
  let nextId = 0;
  const command = (sessionId, method, params = {}) => new Promise((resolve,reject) => {
    const id = ++nextId;
    const key = sessionId + ':' + id;
    const timer = setTimeout(() => {pending.delete(key);reject(Error('Bounded child CDP command timed out: '+method));},3000);
    pending.set(key,{resolve:value => {clearTimeout(timer);resolve(value);},reject:error => {clearTimeout(timer);reject(error);}});
    cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(error => {pending.delete(key);clearTimeout(timer);reject(error);});
  });
  const install = async (sessionId,contextId) => {
    const result = await command(sessionId,'Runtime.evaluate',{expression:hook,contextId,returnByValue:true});
    if(result.exceptionDetails) trace.errors.push({stage:'hook',sessionId,exception:result.exceptionDetails});
  };
  cdp.on('Target.receivedMessageFromTarget',event => {
    const message = JSON.parse(event.message);
    const sessionId = event.sessionId;
    if(message.id) {
      const key = sessionId+':'+message.id;
      const waiter = pending.get(key);
      if(waiter) {pending.delete(key);if(message.error) waiter.reject(Error(JSON.stringify(message.error)));else waiter.resolve(message.result);}
      return;
    }
    if(message.method === 'Runtime.bindingCalled' && message.params.name === '__saveTrace') {
      const row = {target:sessions.get(sessionId),contextId:message.params.executionContextId,...JSON.parse(message.params.payload)};
      if(trace.events.length < 12000) trace.events.push(row); else trace.truncated = true;
    }
    if(message.method === 'Runtime.executionContextCreated') {
      trace.events.push({kind:'realm-created',target:sessions.get(sessionId),contextId:message.params.context.id,time:Date.now()});
      tasks.push(install(sessionId,message.params.context.id).catch(error => trace.errors.push({stage:'install',error:String(error)})));
    }
    if(message.method === 'Runtime.executionContextDestroyed' || message.method === 'Runtime.executionContextsCleared') trace.events.push({kind:'realm-cleared',target:sessions.get(sessionId),time:Date.now()});
  });
  cdp.on('Target.targetCreated',event => {
    if(event.targetInfo.type !== 'service_worker') return;
    tasks.push((async () => {
      const {sessionId} = await cdp.send('Target.attachToTarget',{targetId:event.targetInfo.targetId,flatten:false});
      sessions.set(sessionId,event.targetInfo);
      await command(sessionId,'Runtime.addBinding',{name:'__saveTrace'});
      await command(sessionId,'Runtime.enable');
    })().catch(error => trace.errors.push({stage:'attach',error:String(error)})));
  });
  await cdp.send('Target.setDiscoverTargets',{discover:true});
  return browser;
};
await import('./probe-sw-browser-channel.mjs');
await Promise.allSettled(tasks);
const reportPath = process.env.TWO_BUILD_REPORT;
const report = JSON.parse(await fs.readFile(reportPath,'utf8'));
trace.sha256 = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
report.saveLifetimeTrace = trace;
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({traceEvents:trace.events.length,traceErrors:trace.errors.length}));
