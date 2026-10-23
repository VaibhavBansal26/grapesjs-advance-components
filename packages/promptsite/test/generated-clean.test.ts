import { scanFiles } from 'grapesjs-advance-components';
import { describe, expect, it } from 'vitest';
import { generateSite } from '../src/generate';
import { mockProvider } from '../src/provider';
import { TEMPLATES } from '../src/templates';

describe('generated sites are clean', () => {
  it('produce no high or medium findings for any template', async () => {
    for (const t of TEMPLATES) {
      const site = await generateSite({
        brief: 'A shop', template: t.id, provider: mockProvider(),
        formEndpoint: 'https://api.example.com/contact', paymentLink: 'https://buy.stripe.com/test_abc',
      });
      const bad = scanFiles({ ...site.files, 'project.json': JSON.stringify(site.project) }).filter((f) => f.severity !== 'low');
      expect(bad, `${t.id}: ${JSON.stringify(bad)}`).toEqual([]);
    }
  });
});
