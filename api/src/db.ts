import pg from "pg";
const { Pool } = pg;


export const pool = new Pool({
connectionString: process.env.DATABASE_URL,
});


export async function migrate() {
const sql = await import("fs/promises").then(f => f.readFile("./migrations/001_init.sql", "utf8"));
await pool.query(sql);
const sql2 = await import("fs/promises").then(f => f.readFile("./migrations/002_sample_indexes.sql", "utf8"));
await pool.query(sql2);
console.log("Migrations applied");
}
