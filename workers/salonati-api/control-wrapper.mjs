import original from './worker.mjs';
import {controlGuard,reportControlError} from '../control-center/control.mjs';
const options={projectId:'repo-1434282479',version:'control-20261111'};
export default {async fetch(request,env,ctx){const denied=await controlGuard(request,env,options);if(denied)return denied;try{const response=await original.fetch(request,env,ctx);if(response.status>=500){const task=reportControlError(env,options);if(ctx)ctx.waitUntil(task);else await task}return response}catch(error){const task=reportControlError(env,options);if(ctx)ctx.waitUntil(task);else await task;throw error}}};
