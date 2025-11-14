require('dotenv').config();
const {Client} = require('pg');

const run = async () => {
  const c = new Client({connectionString: process.env.DATABASE_URL});
  await c.connect();

  // Insert test team with UUID
  const result = await c.query(`
    INSERT INTO team (name)
    VALUES ('Test Team')
    ON CONFLICT DO NOTHING
    RETURNING id, name
  `);

  if (result.rows.length > 0) {
    console.log('Created team:', result.rows[0]);
  } else {
    const existing = await c.query('SELECT id, name FROM team LIMIT 1');
    console.log('Existing team:', existing.rows[0]);
  }

  await c.end();
};

run().catch(console.error);
