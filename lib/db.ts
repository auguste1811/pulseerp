import { Pool, QueryResultRow } from "pg";
const globalForDb=globalThis as unknown as {pool?:Pool};
export const pool=globalForDb.pool??new Pool({connectionString:process.env.DATABASE_URL});
if(process.env.NODE_ENV!=="production")globalForDb.pool=pool;
export async function query<T extends QueryResultRow=QueryResultRow>(text:string,params:any[]=[]){return (await pool.query<T>(text,params)).rows;}
