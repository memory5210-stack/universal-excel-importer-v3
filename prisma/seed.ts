import { seedDatabase } from "../src/lib/seed";

async function main() {
  console.log("Seeding database...");
  await seedDatabase();
  console.log("Database seeded successfully!");
}

main().catch(console.error);
