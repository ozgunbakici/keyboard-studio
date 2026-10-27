/** The few GitHub REST calls the sync needs, made straight from the browser. */

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const call = async <T>(token: string, method: string, path: string, body?: unknown): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      // GitHub lets browsers cache answers for a minute; a sync must always see the latest state.
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new GitHubError(0, 'GitHub’a ulaşılamadı.');
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as {message?: string};
    throw new GitHubError(res.status, detail.message ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
};

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const fromBase64 = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

/** The account a token belongs to. */
export const tokenLogin = async (token: string) => (await call<{login: string}>(token, 'GET', '/user')).login;

export type RepoInfo = {private: boolean; default_branch: string; full_name: string; html_url: string};
export type FileChange = {path: string; content: string | null};

export class GitHubRepo {
  constructor(
    private readonly token: string,
    readonly owner: string,
    readonly name: string,
  ) {}

  private call<T>(method: string, path: string, body?: unknown) {
    return call<T>(this.token, method, `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.name)}${path}`, body);
  }

  info() {
    return this.call<RepoInfo>('GET', '');
  }

  /** Latest commit of a branch, or null while the repository is still empty. */
  async head(branch: string) {
    try {
      return (await this.call<{object: {sha: string}}>('GET', `/git/ref/heads/${encodeURIComponent(branch)}`)).object.sha;
    } catch (error) {
      if (error instanceof GitHubError && (error.status === 404 || error.status === 409)) return null;
      throw error;
    }
  }

  /** Files of a commit: path -> blob id. */
  async files(commitSha: string) {
    const commit = await this.call<{tree: {sha: string}}>('GET', `/git/commits/${commitSha}`);
    const tree = await this.call<{tree: {path: string; type: string; sha: string}[]}>('GET', `/git/trees/${commit.tree.sha}?recursive=1`);
    return {tree: commit.tree.sha, files: new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]))};
  }

  async readText(blobSha: string) {
    return fromBase64((await this.call<{content: string}>('GET', `/git/blobs/${blobSha}`)).content);
  }

  /** The first commit of an empty repository. */
  async createFile(branch: string, path: string, content: string, message: string) {
    await this.call('PUT', `/contents/${path}`, {message, content: toBase64(content), branch});
  }

  /**
   * One commit with all changes (null content deletes a file). Fails with 422
   * when the branch moved on meanwhile, so the caller can merge again.
   */
  async commit(branch: string, parent: string, baseTree: string, changes: FileChange[], message: string) {
    const tree = await this.call<{sha: string}>('POST', '/git/trees', {
      base_tree: baseTree,
      tree: changes.map(({path, content}) =>
        content === null ? {path, mode: '100644', type: 'blob', sha: null} : {path, mode: '100644', type: 'blob', content},
      ),
    });
    const commit = await this.call<{sha: string}>('POST', '/git/commits', {message, tree: tree.sha, parents: [parent]});
    await this.call('PATCH', `/git/refs/heads/${encodeURIComponent(branch)}`, {sha: commit.sha, force: false});
    return {commit: commit.sha, tree: tree.sha};
  }
}
