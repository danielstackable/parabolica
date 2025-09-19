const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER || 'danielstackable';
  const repo   = process.env.GITHUB_REPO  || 'parabolica';
  const file   = process.env.WORKFLOW_FILE || 'manual-sync.yml';
  const branch = process.env.WORKFLOW_BRANCH || 'main';

  if (!token) return { statusCode: 500, headers: cors, body: JSON.stringify({ ok:false, error:'Missing GITHUB_TOKEN' }) };

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/dispatches`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ref: branch })
    });
    if (res.status === 204) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok:true, workflow_url:`https://github.com/${owner}/${repo}/actions/workflows/${file}` }) };
    }
    const text = await res.text();
    return { statusCode: res.status, headers: cors, body: JSON.stringify({ ok:false, status:res.status, body:text.slice(0,400) }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
