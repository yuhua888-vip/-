import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, STORAGE_KEY } from '../assets/app/services/storage.js';
import { GameSession } from '../assets/app/game/session.js';
test('single-table lease denies a second tab, rejects stale revisions, and releases on page exit',async()=>{
  const keys=['navigator','window','localStorage'];const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const records=new Map();let held=false;const page=new EventTarget();
  Object.defineProperty(globalThis,'window',{value:page,configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(_name,_options,callback)=>{if(held)return callback(null);held=true;try{return await callback({name:'test'});}finally{held=false;}}}},configurable:true});
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)},configurable:true});
  try{
    const first=new LocalStore(),second=new LocalStore();assert.equal(await first.acquire(),true);assert.equal(await second.acquire(),false);
    const session=new GameSession(first.save);session.persist();assert.equal(JSON.parse(records.get(STORAGE_KEY)).revision,1);assert.throws(()=>second.save(session.snapshot()),/控制权/);
    const before=session.balance;const external=JSON.parse(records.get(STORAGE_KEY));external.revision=2;records.set(STORAGE_KEY,JSON.stringify(external));assert.throws(()=>session.place('player',5000),/其他页面/);assert.equal(session.balance,before);
    page.dispatchEvent(new Event('pagehide'));await Promise.resolve();await Promise.resolve();assert.throws(()=>first.save(session.snapshot()),/控制权/);assert.equal(await second.acquire(),true);page.dispatchEvent(new Event('pagehide'));await Promise.resolve();
  }finally{for(const key of keys){const descriptor=originals.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
