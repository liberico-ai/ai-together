// Seed leaderboard data into LOCAL database
import postgres from "postgres";

async function seed() {
  // Connect to the DB from env (dev: local docker; set DATABASE_URL to override).
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = postgres(DATABASE_URL);

  // Check existing users
  const users = await sql`SELECT id, name, username FROM users`;
  console.log(`Found ${users.length} users:`, users.map(u => u.name));

  if (users.length === 0) {
    console.log("⚠️ No users in local DB. Register via web app first.");
    await sql.end();
    return;
  }

  // Create extra sample users if < 4
  if (users.length < 4) {
    console.log("Creating extra sample users...");
    const samples = [
      { name: "Nguyễn Minh Tuấn", username: "tuannm", email: "tuannm@demo.com" },
      { name: "Trần Thu Hà", username: "hatt", email: "hatt@demo.com" },
      { name: "Lê Quang Dũng", username: "dunglq", email: "dunglq@demo.com" },
      { name: "Phạm Thị Linh", username: "linhpt", email: "linhpt@demo.com" },
      { name: "Võ Đức Thắng", username: "thangvd", email: "thangvd@demo.com" },
    ];
    for (const u of samples) {
      const existing = await sql`SELECT id FROM users WHERE username = ${u.username}`;
      if (existing.length === 0) {
        await sql`
          INSERT INTO users (id, name, username, email, role, email_verified, created_at, updated_at)
          VALUES (${crypto.randomUUID()}, ${u.name}, ${u.username}, ${u.email}, 'user', true, NOW(), NOW())
        `;
        console.log(`  ✅ Created: ${u.name}`);
      }
    }
  }

  // Refresh users list
  const allUsers = await sql`SELECT id, name, username FROM users`;
  console.log(`\nTotal users: ${allUsers.length}`);

  const eventTypes = [
    { type: "task_done", points: 10, refType: "task" },
    { type: "task_early", points: 15, refType: "task" },
    { type: "task_late", points: 5, refType: "task" },
    { type: "comment", points: 1, refType: "comment" },
    { type: "doc_approved", points: 3, refType: "document" },
    { type: "commit", points: 2, refType: "commit" },
  ];

  // Clear old sample data
  await sql`DELETE FROM score_events WHERE ref_id LIKE 'sample-%'`;
  console.log("Cleared old sample data");

  const now = new Date();
  let scoreCount = 0;

  for (const user of allUsers) {
    const count = 15 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

      const evt = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      await sql`
        INSERT INTO score_events (id, user_id, event_type, points, ref_type, ref_id, created_at)
        VALUES (${crypto.randomUUID()}, ${user.id}, ${evt.type}, ${evt.points}, ${evt.refType}, ${"sample-" + crypto.randomUUID().slice(0, 8)}, ${d})
      `;
      scoreCount++;
    }
  }
  console.log(`✅ Inserted ${scoreCount} score events`);

  // Activity logs
  let activityCount = 0;
  for (const user of allUsers) {
    for (let day = 0; day < 14; day++) {
      if (Math.random() < 0.8) {
        const d = new Date(now);
        d.setDate(d.getDate() - day);
        const dateStr = d.toISOString().split("T")[0];
        const loginCount = 1 + Math.floor(Math.random() * 3);
        const actionCount = 1 + Math.floor(Math.random() * 8);
        try {
          await sql`
            INSERT INTO user_activity_log (id, user_id, activity_date, login_count, action_count, created_at)
            VALUES (${crypto.randomUUID()}, ${user.id}, ${dateStr}, ${loginCount}, ${actionCount}, ${d})
          `;
          activityCount++;
        } catch {
          activityCount++;
        }
      }
    }
  }
  console.log(`✅ Inserted ${activityCount} activity logs`);

  // Preview
  const scores = await sql`
    SELECT u.name, SUM(se.points) as total
    FROM score_events se JOIN users u ON se.user_id = u.id
    GROUP BY u.name ORDER BY total DESC
  `;
  console.log("\n🏆 Leaderboard Preview:");
  scores.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}: ${s.total} pts`));

  console.log("\n🎉 Done! Refresh http://localhost:3000/leaderboard");
  await sql.end();
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
