// control-panel/netlify/functions/deploy-now.js
// POST -> dispatch workflow; returns { ok, workflow_url, run_id, run_html_url }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER || 'danielstackable';
  const repo   = process.env.GITHUB_REPO  || 'parabolica';
  const file   = process.env.WORKFLOW_FILE || 'manual-sync.yml';   // filename is OK here
  const branch = process.env.WORKFLOW_BRANCH || 'main';

  if (!token) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok:false, error:'Missing GITHUB_TOKEN' }) };
  }

  // 1) Dispatch
  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/dispatches`;
  const started = Date.now();

  const d = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref: branch })
  });

  if (d.status !== 204) {
    const body = await d.text();
    return { statusCode: d.status, headers: cors, body: JSON.stringify({ ok:false, body: body.slice(0,500) }) };
  }

  const workflow_url = `https://github.com/${owner}/${repo}/actions/workflows/${file}`;

  // 2) Try to locate the newly-created run (poll a few seconds)
  const runsUrlBase = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(branch)}&per_page=5`;

  let run_id = null, run_html_url = null;
  for (let i=0; i<10; i++) {
    await sleep(1200);
    const r = await fetch(runsUrlBase, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!r.ok) continue;
    const j = await r.json();
    const after = started - 60_000; // accept runs created within the last minute
    const candidate = (j.workflow_runs || []).find(run =>
      (run.status === 'queued' || run.status === 'in_progress') &&
      new Date(run.created_at).getTime() >= after
    );
    if (candidate) {
      run_id = candidate.id;
      run_html_url = candidate.html_url;
      break;
    }
  }

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ ok:true, workflow_url, run_id, run_html_url })
  };
};
