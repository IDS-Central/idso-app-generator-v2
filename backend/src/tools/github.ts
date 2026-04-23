/**
 * GitHub write-tool handler(s).
 *
 * Implements `gh_create_repo`:
 * - Creates a new PRIVATE repository under the IDS-Central org named
 *   `idso-app-<app_name>`.
 * - Seeds the initial `main` branch with the full tree of
 *   `IDS-Central/idso-app-template-v2` as a single commit, using the
 *   GitHub Git Data API (no shell git required).
 * - Idempotent on repo-already-exists: returns the existing repo metadata
 *   instead of failing, but does NOT re-seed to avoid clobbering local
 *   changes.
 *
 * Auth: GitHub App installation token, minted fresh per handler call by
 * signing an RS256 JWT with the app's private key and exchanging it at
 * `POST /app/installations/<id>/access_tokens`.
 */

import crypto from 'node:crypto';
import type { ToolHandler } from './types.js';
import { ok, err } from './types.js';

/* -------------------- client -------------------- */

export type GithubConfig = {
  appId: string;
  installationId: string;
  privateKeyPem: string;
  /** GitHub org under which new repos are created. */
  org: string;
  /** Repo (under `org`) whose tree seeds every generated app. */
  seedRepo: string;
};

export type GithubClient = {
  /** Minted installation token (may be cached). */
  getInstallationToken: () => Promise<string>;
  config: GithubConfig;
};

/** Base64url-encode a Buffer/string without padding. */
function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Sign an RS256 JWT with the GitHub App's PEM private key. */
function signAppJwt(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60, // GitHub caps JWT life at 10 min; 9 is safe.
      iss: appId,
    }),
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const sig = b64url(signer.sign(privateKeyPem));
  return `${header}.${payload}.${sig}`;
}

export function buildGithubClient(config: GithubConfig): GithubClient {
  let cached: { token: string; expiresAt: number } | null = null;

  async function getInstallationToken(): Promise<string> {
    // Refresh 60s before GitHub's stated expiry.
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
    const jwt = signAppJwt(config.appId, config.privateKeyPem);
    const res = await fetch(
      `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'idso-app-generator-v2',
        },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`installation token exchange failed: HTTP ${res.status} ${body}`);
    }
    const j = (await res.json()) as { token: string; expires_at: string };
    cached = { token: j.token, expiresAt: new Date(j.expires_at).getTime() };
    return j.token;
  }

  return { getInstallationToken, config };
}

/* -------------------- GitHub REST helpers -------------------- */

async function gh<T>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'idso-app-generator-v2',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`GitHub ${method} ${path} failed: HTTP ${res.status} ${text}`) as Error & {
      status: number;
    };
    error.status = res.status;
    throw error;
  }
  // Some DELETE-style endpoints return empty body.
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await res.json()) as T;
  return undefined as never;
}

/* -------------------- handler -------------------- */

const APP_NAME_RE = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/;

type GhCreateRepoInput = { app_name: string; description: string };
type GhCreateRepoOutput = {
  repo_full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  seeded_from: string;
  already_existed: boolean;
  initial_commit_sha?: string;
};

type GhRepo = {
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
};

type GhRef = { object: { sha: string; type: string } };
type GhCommit = { sha: string; tree: { sha: string } };
type GhTree = {
  sha: string;
  tree: Array<{
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    sha: string;
    size?: number;
  }>;
  truncated: boolean;
};

export const ghCreateRepo: ToolHandler<GhCreateRepoInput, GhCreateRepoOutput> = async (
  input,
  deps,
) => {
  const appName = String((input as GhCreateRepoInput)?.app_name ?? '').trim();
  const description = String((input as GhCreateRepoInput)?.description ?? '').trim();
  if (!APP_NAME_RE.test(appName)) {
    return err(
      `invalid app_name "${appName}": must match ${APP_NAME_RE.source}`,
      'invalid_input',
    );
  }
  if (!description) {
    return err('description is required and must be non-empty', 'invalid_input');
  }

  const gh_ = deps.gh;
  if (!gh_) return err('github client not configured on backend', 'github_not_configured');

  const repoName = `idso-app-${appName}`;
  const org = gh_.config.org;
  const seedOwner = org;
  const seedRepo = gh_.config.seedRepo;
  const repoFullName = `${org}/${repoName}`;
  const log = deps.logger.child({ tool: 'gh_create_repo', app_name: appName, repo: repoFullName });

  const token = await gh_.getInstallationToken();

  /* ---- 1. Create (or detect existing) repo ---- */
  let alreadyExisted = false;
  let repo: GhRepo;
  try {
    repo = await gh<GhRepo>(token, 'POST', `/orgs/${org}/repos`, {
      name: repoName,
      description: description.slice(0, 350),
      private: true,
      auto_init: true, // create with an initial empty-ish commit so we have a base SHA to amend
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    });
    log.info({ event: 'gh_repo_created', html_url: repo.html_url }, 'repo created');
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    const msg = e instanceof Error ? e.message : String(e);
    if (status === 422 && /name already exists/i.test(msg)) {
      alreadyExisted = true;
      log.info({ event: 'gh_repo_already_exists' }, 'repo already exists; skipping seed');
      repo = await gh<GhRepo>(token, 'GET', `/repos/${repoFullName}`);
      return ok({
        repo_full_name: repo.full_name,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
        private: repo.private,
        seeded_from: `${seedOwner}/${seedRepo}`,
        already_existed: true,
      });
    }
    log.error({ event: 'gh_repo_create_failed', err: msg, status }, 'repo create failed');
    return err(`failed to create repo ${repoFullName}: ${msg}`, 'repo_create_failed');
  }

  /* ---- 2. Seed initial commit from template-v2 tree ---- */
  //
  // Strategy: copy the template's HEAD tree SHA (blobs are already in
  // the template repo; GitHub will let us reference them from the new
  // repo IF we first import them as tree objects in the new repo).
  // Simplest reliable path:
  //   a. GET /repos/seed/git/ref/heads/main    -> commitSha
  //   b. GET /repos/seed/git/commits/<sha>     -> treeSha
  //   c. GET /repos/seed/git/trees/<sha>?recursive=1
  //      For each blob we read the blob content via /git/blobs/<sha>
  //      and create it fresh in the new repo. Small trees (<1k files,
  //      <1MB each) fit easily in a single batched tree create.
  //   d. POST /repos/new/git/trees  (with base_tree=null and flattened entries)
  //   e. POST /repos/new/git/commits (parent = auto_init commit)
  //   f. PATCH /repos/new/git/refs/heads/main to point at new commit
  //
  // For Commit 2b part 2, we do the straightforward version and accept
  // that seeding is O(N_files) API calls. Template-v2 is ~40 files so
  // this is ~80 calls (blob fetch + blob create). If seed size grows we
  // can switch to the Contents API upload-pack approach.

  let seedCommitSha: string | undefined;
  try {
    const seedRef = await gh<GhRef>(token, 'GET', `/repos/${seedOwner}/${seedRepo}/git/ref/heads/main`);
    const seedCommit = await gh<GhCommit>(
      token,
      'GET',
      `/repos/${seedOwner}/${seedRepo}/git/commits/${seedRef.object.sha}`,
    );
    const seedTree = await gh<GhTree>(
      token,
      'GET',
      `/repos/${seedOwner}/${seedRepo}/git/trees/${seedCommit.tree.sha}?recursive=1`,
    );
    if (seedTree.truncated) {
      log.warn(
        { event: 'gh_seed_tree_truncated', entries: seedTree.tree.length },
        'seed tree response was truncated by GitHub; seeded repo may be missing files',
      );
    }

    // Copy blobs: fetch from seed, recreate in new repo, collect new-repo SHAs.
    type NewEntry = {
      path: string;
      mode: '100644' | '100755' | '040000' | '160000' | '120000';
      type: 'blob' | 'tree' | 'commit';
      sha: string;
    };
    const newEntries: NewEntry[] = [];

    for (const entry of seedTree.tree) {
      if (entry.type !== 'blob') continue; // Skip sub-trees; GitHub infers them from blob paths.

      const blob = await gh<{ content: string; encoding: string }>(
        token,
        'GET',
        `/repos/${seedOwner}/${seedRepo}/git/blobs/${entry.sha}`,
      );
      const newBlob = await gh<{ sha: string }>(token, 'POST', `/repos/${repoFullName}/git/blobs`, {
        content: blob.content,
        encoding: blob.encoding,
      });
      newEntries.push({
        path: entry.path,
        mode: entry.mode,
        type: 'blob',
        sha: newBlob.sha,
      });
    }

    const newTree = await gh<{ sha: string }>(token, 'POST', `/repos/${repoFullName}/git/trees`, {
      tree: newEntries,
    });

    // Parent commit = the auto_init commit on main of the fresh repo.
    const newRef = await gh<GhRef>(token, 'GET', `/repos/${repoFullName}/git/ref/heads/main`);
    const newCommit = await gh<{ sha: string }>(
      token,
      'POST',
      `/repos/${repoFullName}/git/commits`,
      {
        message: `seed: ${appName} from ${seedOwner}/${seedRepo}@${seedRef.object.sha.slice(0, 7)}\n\n${description}`,
        tree: newTree.sha,
        parents: [newRef.object.sha],
      },
    );
    await gh(token, 'PATCH', `/repos/${repoFullName}/git/refs/heads/main`, {
      sha: newCommit.sha,
      force: false,
    });
    seedCommitSha = newCommit.sha;
    log.info(
      {
        event: 'gh_repo_seeded',
        blobs: newEntries.length,
        seed_sha: seedRef.object.sha,
        new_sha: newCommit.sha,
      },
      'repo seeded from template-v2',
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number })?.status;
    log.error({ event: 'gh_repo_seed_failed', err: msg, status }, 'seeding failed after repo create');
    return err(
      `repo ${repoFullName} was created but seeding from ${seedOwner}/${seedRepo} failed: ${msg}`,
      'repo_seed_failed',
    );
  }

  return ok({
    repo_full_name: repo.full_name,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
    default_branch: repo.default_branch,
    private: repo.private,
    seeded_from: `${seedOwner}/${seedRepo}`,
    already_existed: alreadyExisted,
    initial_commit_sha: seedCommitSha,
  });
};
