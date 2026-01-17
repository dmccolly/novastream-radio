
export interface GitHubFile {
  path: string;
  content: string;
}

export const pushToGitHub = async (
  token: string,
  owner: string,
  repo: string,
  files: GitHubFile[],
  onLog: (msg: string) => void
) => {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    onLog(`>> GITHUB: INITIATING_DEPLOY_TO [${owner}/${repo}]`);

    let latestCommitSha = "";
    const refRes = await fetch(`${baseUrl}/git/matching-refs/heads/main`, { headers });
    const refs = await refRes.json();

    if (!refRes.ok || refs.length === 0) {
      onLog(">> GITHUB: EMPTY_REPO_DETECTED. INITIALIZING...");
      const initRes = await fetch(`${baseUrl}/contents/README.md`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: "Initial commit",
          content: btoa("# NovaStream Radio\nDirect deployment via Gateway.")
        })
      });
      if (!initRes.ok) throw new Error("INITIALIZATION_FAILED");
      
      await new Promise(r => setTimeout(r, 2000));
      const refRetry = await fetch(`${baseUrl}/git/matching-refs/heads/main`, { headers });
      const refsRetry = await refRetry.json();
      latestCommitSha = refsRetry[0].object.sha;
    } else {
      latestCommitSha = refs[0].object.sha;
    }

    const commitRes = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, { headers });
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const treePayload = {
      base_tree: baseTreeSha,
      tree: files.map(f => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        content: f.content
      }))
    };

    const newTreeRes = await fetch(`${baseUrl}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(treePayload)
    });
    const newTreeData = await newTreeRes.json();
    const newTreeSha = newTreeData.sha;

    const commitPayload = {
      message: `NovaStream Deployment: ${new Date().toISOString()}`,
      tree: newTreeSha,
      parents: [latestCommitSha]
    };

    const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload)
    });
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/main`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitSha })
    });

    if (!updateRefRes.ok) throw new Error("PUSH_REJECTED");
    onLog(">> GITHUB: DEPLOY_SUCCESS");
    return { success: true };
  } catch (err: any) {
    onLog(`!! GITHUB_ERR: ${err.message}`);
    throw err;
  }
};
