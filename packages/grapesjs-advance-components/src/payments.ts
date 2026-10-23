import type { Editor } from 'grapesjs';
import { DEFAULT_ALLOWED_HOSTS, checkoutButton } from './builtin';
import type { PaymentsOptions } from './types';

export { CHECKOUT_TYPE, DEFAULT_ALLOWED_HOSTS } from './builtin';

/**
 * Register the checkout button type (see `checkoutButton` in builtin.ts for how it works).
 * The block itself is added by `loadBlocks`, so it follows the `components` option.
 */
export function loadPayments(editor: Editor, opts: PaymentsOptions = {}) {
  checkoutButton(opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS).installType(editor);
}
