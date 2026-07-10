import{c}from"./index-DczUDOa7.js";import{p as r}from"./idb-BaKKs8dd.js";/**
 * @license lucide-react v0.441.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=c("Plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);async function u(){return(await r.getAll()).sort((e,a)=>new Date(a.createdAt).getTime()-new Date(e.createdAt).getTime())}async function d(t){const e={...t,id:crypto.randomUUID(),createdAt:new Date().toISOString()};return r.create(e)}async function p(t,e){const a=await r.getById(t);if(!a)return null;const n={...a,...e};return r.update(n)}async function l(t){return await r.getById(t)?(await r.delete(t),!0):!1}export{i as P,d as c,l as d,u as g,p as u};
