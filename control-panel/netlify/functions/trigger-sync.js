export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, WORKFLOW_FILE = 'manual-sync.yml', WORKFLOW_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing GitHub env vars' }) };
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const body = { ref: WORKFLOW_BRANCH, inputs: {} };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'parabolica-control-panel'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      return { statusCode: r.status, body: JSON.stringify({ error: text }) };
    }

    const workflowUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`;
    return { statusCode: 200, body: JSON.stringify({ ok: true, workflow_url: workflowUrl }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
