const TOTAL_REQUESTS = 1000;
const CONCURRENCY_LIMIT = 50; // Batched so we don't exhaust your Windows sockets instantly

async function fireRequest(id) {
  // 5% chance to inject the poison pill
  const isCorrupt = Math.random() < 0.05; 
  
  const payload = {
    providerEventId: `CHAOS-${Date.now()}-${id}`,
    patientId: `pt_chaos_${id}`,
    documentType: 'LabResult',
    filePayload: isCorrupt ? 'CORRUPT_POISON_PILL' : 'VGhpcyBpcyB2YWxpZCBkYXRh...',
  };

  try {
    const res = await fetch('http://localhost:3000/webhooks/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.status;
  } catch (e) {
    console.error(`\n[Network Error] Cannot reach Gatekeeper: ${e.message}`);
    return 500;
  }
}

async function runChaos() {
  console.log(`🔥 Starting Chaos Test: Firing ${TOTAL_REQUESTS} requests...`);
  let successes = 0;

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY_LIMIT) {
    const batch = [];
    for (let j = 0; j < CONCURRENCY_LIMIT; j++) {
      if (i + j >= TOTAL_REQUESTS) break;
      batch.push(fireRequest(i + j));
    }
    
    const results = await Promise.all(batch);
    successes += results.filter(status => status === 202).length;
    
    process.stdout.write(`\r🚀 Fired: ${i + batch.length} / ${TOTAL_REQUESTS}`);
  }

  console.log(`\n✅ Chaos injection complete.`);
  console.log(`Gatekeeper accepted: ${successes} payloads in milliseconds.`);
  console.log(`👉 Now watch your Worker terminal handle the load, the retries, and the failures!`);
}

runChaos();