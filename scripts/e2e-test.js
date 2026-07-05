async function apiCall(method, url, body = null, headers = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error: ${res.status} ${errText}`);
  }
  return res.json();
}

async function runFlow() {
  console.log('--- Starting End-to-End Operational Flow Test ---');
  
  // 1. Get first organization
  const orgs = await apiCall('GET', 'http://localhost:4000/api/v1/organizations');
  const orgId = orgs[0].id;
  console.log(`Using Org ID: ${orgId}`);

  // 2. Get an active Agent
  const agents = await apiCall('GET', 'http://localhost:4000/api/v1/sales-agents', null, { 'x-organization-id': orgId });
  const agent = agents[0];
  if (!agent) {
    console.log('No agents found. Start the simulator first.');
    return;
  }
  console.log(`Using Agent: ${agent.user.name} (${agent.id})`);

  // 3. Create a Store
  const store = await apiCall('POST', 'http://localhost:4000/api/v1/stores', {
    name: 'Test Auto Store',
    address: 'Tashkent, Chorsu',
    lat: 41.326,
    lng: 69.239,
    status: 'ACTIVE'
  }, { 'x-organization-id': orgId });
  console.log(`Created Store: ${store.name}`);

  // 4. Create a Task (Replenishment)
  const task = await apiCall('POST', 'http://localhost:4000/api/v1/tasks', {
    title: 'Urgent Replenishment',
    type: 'REPLENISHMENT',
    address: store.address,
    lat: store.lat,
    lng: store.lng,
    agentId: agent.id,
    priority: 'HIGH'
  }, { 'x-organization-id': orgId });
  console.log(`Created Task: ${task.title} (ID: ${task.id})`);

  console.log('Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  // 5. Start the Task
  await apiCall('PATCH', `http://localhost:4000/api/v1/tasks/${task.id}/status`, {
    status: 'IN_PROGRESS',
    lat: 41.325,
    lng: 69.238,
    changedBy: agent.userId
  }, { 'x-organization-id': orgId });
  console.log(`Task ${task.id} moved to IN_PROGRESS`);

  console.log('Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  // 6. Complete the Task
  await apiCall('PATCH', `http://localhost:4000/api/v1/tasks/${task.id}/status`, {
    status: 'COMPLETED',
    lat: store.lat,
    lng: store.lng,
    changedBy: agent.userId
  }, { 'x-organization-id': orgId });
  console.log(`Task ${task.id} moved to COMPLETED!`);
  
  console.log('--- Test Flow Completed Successfully ---');
}

runFlow().catch(err => console.error(err.message));
