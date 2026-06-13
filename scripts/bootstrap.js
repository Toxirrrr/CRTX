const fs = require('fs');
const path = require('path');

const directories = [
  'tasks',
  'capsules',
  'decisions',
  'evidence',
  'skills',
  'events',
  'runtime'
];

console.log('⚡ Initializing CRTX Workspace...\n');

// Create architecture directories
for (const dir of directories) {
  const target = path.join(process.cwd(), dir);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    console.log(`  ✓ Created directory: ${dir}/`);
  } else {
    console.log(`  - Directory exists: ${dir}/`);
  }
}

// Initialize runtime registry files if they don't exist
const runtimeDir = path.join(process.cwd(), 'runtime');

const defaultRegistry = {
  $schema: "crtx/runtime-registry/1.0",
  runtimes: {},
  updatedAt: new Date().toISOString()
};

const defaultHealth = {
  status: "active",
  lastCheck: new Date().toISOString(),
  activeRuntimes: []
};

const defaultCapabilities = {
  "E2E_TESTING": [],
  "CODE_REVIEW": [],
  "ARCHITECTURE": [],
  "IMPLEMENTATION": []
};

const writeIfNotExists = (filename, content) => {
  const filepath = path.join(runtimeDir, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`  ✓ Created registry: runtime/${filename}`);
  }
};

console.log('\nScanning for available runtimes...');
writeIfNotExists('runtimes.json', defaultRegistry);
writeIfNotExists('health.json', defaultHealth);
writeIfNotExists('capabilities.json', defaultCapabilities);

console.log('\n✅ CRTX is ready. Your AI coordination workspace is active.');
console.log('To dispatch a task, simply create a JSON file in the tasks/ directory.');
