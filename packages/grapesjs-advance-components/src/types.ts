import type { Editor } from 'grapesjs';
import type { ComponentDefinition } from './define/types';

export type ComponentKind =
  | 'faq'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'link'
  | 'image'
  | 'video'
  | 'divider'
  | 'map'
  | 'button'
  | 'slider'
  | 'header'
  | 'footer'
  | 'quote'
  | 'progress-bar'
  | 'inputElement'
  | 'dropdown'
  | 'textarea'
  | 'checkout'
  | 'pricing'
  | 'form'
  | 'newsletter'
  | 'hero'
  | 'features'
  | 'cta'
  | 'testimonials'
  | 'logos'
  | 'team'
  | 'blog'
  | 'stats'
  | 'steps'
  | 'banner'
  | 'compare'
  | 'tabs';

export interface FormElementOptions {
  type?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface ButtonElementOptions {
  buttonText?: string;
}

/** One entry of the `components` option; each entry becomes one (or more) blocks. */
export interface ComponentOption {
  /** Set to `false` to skip registering this block. Defaults to `true`. */
  visible?: boolean;
  /** Text shown under the block icon. */
  label: string;
  /** Unique name. An entry with the same name as a default replaces that default. */
  name: string;
  /** Block manager category. */
  category?: string;
  componentType: ComponentKind;
  /** `heading` only: restrict to one tag, otherwise h1–h6 are all registered. */
  headingType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  formElement?: FormElementOptions;
  buttonElement?: ButtonElementOptions;
  checkoutElement?: CheckoutElementOptions;
  formAction?: FormActionOptions;
  /** Kept for backwards compatibility with v1 option objects; unused. */
  type?: string;
}

export interface CheckoutElementOptions {
  /** `link`: go to a Stripe Payment Link. `session`: ask your backend for a Checkout Session URL. */
  mode?: 'link' | 'session';
  buttonText?: string;
  /** Stripe Payment Link (https://buy.stripe.com/…) for `link` mode. */
  url?: string;
  /** Your endpoint for `session` mode: POST { priceId, quantity } → { url }. */
  endpoint?: string;
  priceId?: string;
  quantity?: number;
}

export interface FormActionOptions {
  /** Where the form posts. Your endpoint, or a form service URL. */
  endpoint?: string;
  encoding?: 'json' | 'form';
  successMessage?: string;
  errorMessage?: string;
  buttonText?: string;
  redirectUrl?: string;
}

export interface PaymentsOptions {
  /** Hosts a checkout redirect may go to. Default: checkout.stripe.com, buy.stripe.com. */
  allowedHosts?: string[];
}

export interface PagesOptions {
  /** Add a Pages button to the editor's options panel. Default `true`. */
  panel?: boolean;
}

export interface AiRequest {
  /** What the user typed. */
  prompt: string;
  /** Instructions for the model. Forward these as the system prompt. */
  system: string;
  /** HTML of the component being edited, when generating in "replace" mode. */
  currentHtml?: string;
  mode: 'insert' | 'replace';
  signal?: AbortSignal;
}

/** Return an HTML string, or an object with `html`. Output is always sanitized. */
export type AiGenerate = (req: AiRequest) => Promise<string | { html: string }>;

export interface AiOptions {
  /** Your function that calls a model. The package never talks to a provider itself. */
  generate: AiGenerate;
  /** Replace the default sanitizer. Must return HTML that is safe to render and export. */
  sanitize?: (html: string) => string;
  /** Override the default system prompt. */
  system?: string;
  /** Show a ✨ button in the toolbar of selected components. Default `true`. */
  toolbar?: boolean;
  /** Command id. Default `aac:ai-generate`. */
  commandId?: string;
  /** Abort the request after this many ms. Default 60000. */
  timeoutMs?: number;
}

export interface PluginOptions {
  components?: ComponentOption[];
  /** Extra i18n messages, keyed by locale. */
  i18n?: Record<string, Record<string, unknown>>;
  /** Inject the default stylesheet for the blocks. Default `true`. */
  injectStyles?: boolean;
  ai?: AiOptions;
  payments?: PaymentsOptions;
  /** Your own components, made with `defineComponent`. Each is installed with its block and CSS. */
  custom?: ComponentDefinition<any>[];
  /** Multi-page editing. `false` disables the commands and panel button. */
  pages?: boolean | PagesOptions;
}

export type PluginContext = {
  editor: Editor;
  options: Required<Pick<PluginOptions, 'injectStyles'>> & PluginOptions & {
    components: ComponentOption[];
  };
};
