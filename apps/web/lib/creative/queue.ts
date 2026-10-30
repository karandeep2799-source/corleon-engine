import {Queue} from "bullmq";
import IORedis from "ioredis";
const g=globalThis as unknown as {creativeRedis?:IORedis;creativeQueue?:Queue};
const connection=g.creativeRedis??new IORedis(process.env.REDIS_URL!,{maxRetriesPerRequest:null});
if(process.env.NODE_ENV!=="production")g.creativeRedis=connection;
export const creativeQueue=g.creativeQueue??new Queue("corleon-creative-generation",{connection,defaultJobOptions:{attempts:3,backoff:{type:"exponential",delay:3000},removeOnComplete:{age:604800,count:5000},removeOnFail:{age:2592000,count:10000}}});
if(process.env.NODE_ENV!=="production")g.creativeQueue=creativeQueue;