// control-panel/netlify/functions/gh-status.js
// GET ?run_id=123 -> returns { ok, run: {status, conclusion, html_url}, job:{name, steps:[] } }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER || 'danielstackable';
  const repo   = process.env.GITHUB_REPO  || 'parabolica';
  const run_id = (event.queryStringParameters || {}).run_id;

  if (!token)  return { statusCode: 500, headers: cors, body: JSON.stringify({ ok:false, error:'Missing GITHUB_TOKEN' }) };
  if (!run_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ ok:false, error:'Missing run_id' }) };

  const gh = (url) => fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  // 1) Run summary
  const runRes = await gh(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}`);
  if (!runRes.ok) {
    const t = await runRes.text();
    return { statusCode: runRes.status, headers: cors, body: JSON.stringify({ ok:false, error:t.slice(0,500) }) };
  }
  const run = await runRes.json();

  // 2) Jobs + steps
  const jobsRes = await gh(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${run_id}/jobs?per_page=10`);
  const jobsJson = jobsRes.ok ? await jobsRes.json() : { jobs: [] };

  // Find the job corresponding to your YAML job name: "sync-and-deploy"
  let job = (jobsJson.jobs || []).find(j => j.name === 'sync-and-deploy') || (jobsJson.jobs || [])[0];

  const payload = {
    ok: true,
    run: {
      id: run.id,
      status: run.status,         // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | cancelled | null (if not completed)
      html_url: run.html_url
    },
    job: job ? {
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      steps: (job.steps || []).map((s, idx) => ({
        number: idx+1,
        name: s.name,
        status: s.status,         // queued | in_progress | completed
        conclusion: s.conclusion  // success | failure | skipped | cancelled | null
      }))
    } : null
  };

  return { statusCode: 200, headers: cors, body: JSON.stringify(payload) };
};
