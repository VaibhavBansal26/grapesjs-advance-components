import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scanFiles } from 'grapesjs-advance-components';

const raw = readFileSync('examples/n8n/site-intake.workflow.json', 'utf8');
const wf = JSON.parse(raw) as {
  nodes: Array<{ id: string; name: string; type: string; typeVersion: number; parameters: Record<string, unknown>; credentials?: unknown }>;
  connections: Record<string, { main: Array<Array<{ node: string }>> }>;
};

describe('n8n workflow template', () => {
  it('has unique node names and ids, and every connection points at a real node', () => {
    const names = wf.nodes.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(wf.nodes.map((n) => n.id)).size).toBe(wf.nodes.length);
    for (const [from, out] of Object.entries(wf.connections)) {
      expect(names).toContain(from);
      for (const branch of out.main) for (const link of branch) expect(names).toContain(link.node);
    }
  });

  it('uses only node types n8n ships', () => {
    const allowed = ['n8n-nodes-base.webhook', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.respondToWebhook', 'n8n-nodes-base.stickyNote'];
    for (const n of wf.nodes) expect(allowed, n.type).toContain(n.type);
  });

  it('protects the webhook, and calls the API with header auth only', () => {
    const hook = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook')!;
    expect(hook.parameters.authentication).toBe('headerAuth');
    for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.httpRequest')) {
      expect(n.parameters.genericAuthType).toBe('httpHeaderAuth');
      expect(String(n.parameters.url)).toMatch(/^http:\/\/localhost:8787\/v1\//);
    }
  });

  it('contains no credentials, tokens or secrets', () => {
    expect(wf.nodes.every((n) => n.credentials === undefined)).toBe(true);
    expect(scanFiles({ 'workflow.json': raw }).filter((f) => f.severity !== 'low')).toEqual([]);
    expect(raw).not.toMatch(/Bearer [A-Za-z0-9]{16,}/);
  });

  it('reaches the real API routes', () => {
    const urls = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest').map((n) => String(n.parameters.url));
    expect(urls).toEqual(['http://localhost:8787/v1/generate', 'http://localhost:8787/v1/audit']);
  });
});
