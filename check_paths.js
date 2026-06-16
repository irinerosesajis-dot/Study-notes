const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("dotenv").config();
const Material = require("./models/Material");

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const materials = await Material.find();
  console.log(`Found ${materials.length} materials`);
  materials.forEach(m => {
    console.log(`- ${m.title}: ${m.filePath}`);
  });
  process.exit(0);
}
run();
