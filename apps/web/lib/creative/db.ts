import {PrismaClient} from "@prisma/client";
const g=globalThis as unknown as {creativePrisma?:PrismaClient};
export const prisma=g.creativePrisma??new PrismaClient({log:process.env.NODE_ENV==="development"?["warn","error"]:["error"]});
if(process.env.NODE_ENV!=="production")g.creativePrisma=prisma;