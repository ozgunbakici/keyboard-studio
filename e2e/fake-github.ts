import {createHash, randomBytes} from 'node:crypto';
import type {BrowserContext, Route} from '@playwright/test';

/**
 * Enough of the GitHub REST API, in memory, for the app's sync: repositories,
 * tokens, refs, commits, trees and blobs. Several browser contexts (devices)
 * can share one instance.
 */

type Commit = {tree: string; parents: string[]; message: string};
type Repo = {private: boolean; branch: string; ref: string | null; commits: Map<string, Commit>; trees: Map<string, Map<string, string>>};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

const id = () => randomBytes(20).toString('hex');

export class FakeGitHub {
  private repos = new Map<string, Repo>();
  private tokens = new Map<string, string>();
  private blobs = new Map<string, string>();
  readonly commitMessages: string[] = [];

  addToken(token: string, login: string) {
    this.tokens.set(token, login);
  }

  addRepo(fullName: string, {isPrivate = true} = {}) {
    this.repos.set(fullName, {private: isPrivate, branch: 'main', ref: null, commits: new Map(), trees: new Map()});
  }

  private blob(content: string) {
    const body = Buffer.from(content, 'utf8');
    const sha = createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
    this.blobs.set(sha, content);
    return sha;
  }

  /** Files at the head of the repository's branch. */
  files(fullName: string) {
    const repo = this.repos.get(fullName)!;
    if (!repo.ref) return new Map<string, string>();
    const tree = repo.trees.get(repo.commits.get(repo.ref)!.tree)!;
    return new Map([...tree].map(([path, sha]) => [path, this.blobs.get(sha)!]));
  }

  attach(context: BrowserContext) {
    return context.route('https://api.github.com/**', (route) => this.handle(route));
  }

  private async handle(route: Route) {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
    const reply = (status: number, body: unknown) =>
      route.fulfill({status, headers: {...cors, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});

    const login = this.tokens.get((request.headers().authorization ?? '').replace(/^Bearer /, ''));
    if (!login) return reply(401, {message: 'Bad credentials'});
    const {pathname} = new URL(request.url());
    if (pathname === '/user') return reply(200, {login});

    const match = pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
    const fullName = match ? `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}` : '';
    const repo = this.repos.get(fullName);
    if (!repo) return reply(404, {message: 'Not Found'});
    const rest = match![3] ?? '';
    const method = request.method();
    const body = method === 'GET' ? null : request.postDataJSON();
    let m: RegExpMatchArray | null;

    if (method === 'GET' && rest === '') {
      return reply(200, {private: repo.private, default_branch: repo.branch, full_name: fullName, html_url: `https://github.com/${fullName}`});
    }
    if (method === 'GET' && (m = rest.match(/^\/git\/ref\/heads\/(.+)$/))) {
      if (!repo.ref) return reply(409, {message: 'Git Repository is empty.'});
      return m[1] === repo.branch ? reply(200, {object: {sha: repo.ref}}) : reply(404, {message: 'Not Found'});
    }
    if (method === 'GET' && (m = rest.match(/^\/git\/commits\/(\w+)$/))) {
      const commit = repo.commits.get(m[1]);
      return commit ? reply(200, {sha: m[1], tree: {sha: commit.tree}}) : reply(404, {message: 'Not Found'});
    }
    if (method === 'GET' && (m = rest.match(/^\/git\/trees\/(\w+)$/))) {
      const tree = repo.trees.get(m[1]);
      if (!tree) return reply(404, {message: 'Not Found'});
      return reply(200, {sha: m[1], truncated: false, tree: [...tree].map(([path, sha]) => ({path, sha, type: 'blob', mode: '100644'}))});
    }
    if (method === 'GET' && (m = rest.match(/^\/git\/blobs\/(\w+)$/))) {
      const content = this.blobs.get(m[1]);
      if (content === undefined) return reply(404, {message: 'Not Found'});
      return reply(200, {sha: m[1], encoding: 'base64', content: Buffer.from(content, 'utf8').toString('base64')});
    }
    if (method === 'PUT' && (m = rest.match(/^\/contents\/(.+)$/))) {
      const tree = new Map(repo.ref ? repo.trees.get(repo.commits.get(repo.ref)!.tree) : []);
      tree.set(decodeURIComponent(m[1]), this.blob(Buffer.from(body.content, 'base64').toString('utf8')));
      const treeId = id();
      const commitId = id();
      repo.trees.set(treeId, tree);
      repo.commits.set(commitId, {tree: treeId, parents: repo.ref ? [repo.ref] : [], message: body.message});
      repo.ref = commitId;
      this.commitMessages.push(body.message);
      return reply(201, {commit: {sha: commitId}});
    }
    if (method === 'POST' && rest === '/git/trees') {
      const tree = new Map(repo.trees.get(body.base_tree) ?? []);
      for (const entry of body.tree as {path: string; sha?: string | null; content?: string}[]) {
        if (entry.sha === null) tree.delete(entry.path);
        else tree.set(entry.path, entry.content !== undefined ? this.blob(entry.content) : entry.sha!);
      }
      const treeId = id();
      repo.trees.set(treeId, tree);
      return reply(201, {sha: treeId});
    }
    if (method === 'POST' && rest === '/git/commits') {
      const commitId = id();
      repo.commits.set(commitId, {tree: body.tree, parents: body.parents, message: body.message});
      return reply(201, {sha: commitId});
    }
    if (method === 'PATCH' && (m = rest.match(/^\/git\/refs\/heads\/(.+)$/))) {
      const commit = repo.commits.get(body.sha);
      if (!commit) return reply(422, {message: 'Object does not exist'});
      if (!body.force && repo.ref && !commit.parents.includes(repo.ref)) return reply(422, {message: 'Update is not a fast forward'});
      repo.ref = body.sha;
      this.commitMessages.push(commit.message);
      return reply(200, {object: {sha: body.sha}});
    }
    return reply(404, {message: `Not handled: ${method} ${rest}`});
  }
}
