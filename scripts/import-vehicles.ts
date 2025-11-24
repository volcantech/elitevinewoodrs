import "dotenv/config";
import { neon } from "@netlify/neon";
import { readFileSync } from "fs";
import { join } from "path";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

async function importVehicles() {
  try {
    console.log("Creating table...");
    await sql`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price INTEGER NOT NULL,
        trunk_weight INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        seats INTEGER NOT NULL,
        particularity VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`CREATE INDEX IF NOT EXISTS idx_category_name ON vehicles (category, name)`;
    console.log("Table created successfully!");

    console.log("Reading SQL file...");
    const sqlContent = readFileSync(join(process.cwd(), "elite_vinewood_vehicles.sql"), "utf-8");

    const insertRegex = /INSERT INTO `vehicles` \(`name`, `category`, `price`, `trunk_weight`, `image_url`, `seats`, `particularity`\) VALUES \(([^)]+)\);/g;
    
    let match;
    let count = 0;
    const vehicles: any[] = [];

    while ((match = insertRegex.exec(sqlContent)) !== null) {
      const values = match[1];
      const parts = values.match(/'(?:[^'\\]|\\.)*'|NULL|\d+/g);
      
      if (parts && parts.length === 7) {
        const [name, category, price, trunk_weight, image_url, seats, particularity] = parts;
        
        vehicles.push({
          name: name.replace(/^'|'$/g, '').replace(/\\'/g, "'"),
          category: category.replace(/^'|'$/g, '').replace(/\\'/g, "'"),
          price: parseInt(price),
          trunk_weight: parseInt(trunk_weight),
          image_url: image_url.replace(/^'|'$/g, '').replace(/\\'/g, "'"),
          seats: parseInt(seats),
          particularity: particularity === 'NULL' ? null : particularity.replace(/^'|'$/g, '').replace(/\\'/g, "'")
        });
        count++;
      }
    }

    console.log(`Found ${count} vehicles to import...`);

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      await sql`
        INSERT INTO vehicles (name, category, price, trunk_weight, image_url, seats, particularity)
        VALUES (${v.name}, ${v.category}, ${v.price}, ${v.trunk_weight}, ${v.image_url}, ${v.seats}, ${v.particularity})
      `;
      
      if ((i + 1) % 50 === 0) {
        console.log(`Imported ${i + 1}/${count} vehicles...`);
      }
    }

    console.log(`Successfully imported ${count} vehicles!`);
  } catch (error) {
    console.error("Error importing vehicles:", error);
    process.exit(1);
  }
}

importVehicles();
