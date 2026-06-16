const mongoose = require("mongoose");
require("dotenv").config();
const Material = require("./models/Material");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");
  
  // Find all materials with empty fields
  const materialsToUpdate = await Material.find({
    $or: [
      { scheme: "" },
      { scheme: { $exists: false } },
      { semester: "" },
      { semester: { $exists: false } },
      { branch: "" },
      { branch: { $exists: false } }
    ]
  });

  console.log(`Found ${materialsToUpdate.length} materials needing migration.`);
  
  for (const m of materialsToUpdate) {
    m.scheme = m.scheme || "2019";
    m.semester = m.semester || "S1";
    m.branch = m.branch || "Computer Science & Engineering";
    await m.save();
    console.log(`Updated material: ${m.title}`);
  }

  console.log("Migration finished.");
  mongoose.disconnect();
}

check();
