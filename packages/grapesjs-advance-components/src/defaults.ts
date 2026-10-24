import type { ComponentOption } from './types';

export const defaultComponents: ComponentOption[] = [
  { label: 'Faq', name: 'faq', category: 'Text', componentType: 'faq' },
  { label: 'Heading', name: 'heading', category: 'Text', componentType: 'heading' },
  { label: 'Paragraph', name: 'paragraph', category: 'Text', componentType: 'paragraph' },
  { label: 'Hero', name: 'hero', category: 'Sections', componentType: 'hero' },
  { label: 'Features', name: 'features', category: 'Sections', componentType: 'features' },
  { label: 'Call to action', name: 'cta', category: 'Sections', componentType: 'cta' },
  { label: 'Quote', name: 'quote', category: 'Text', componentType: 'quote' },
  { label: 'List', name: 'list', category: 'Text', componentType: 'list' },
  { label: 'Link', name: 'link', category: 'Custom', componentType: 'link' },
  { label: 'Button', name: 'button', category: 'Custom', componentType: 'button' },
  { label: 'Divider', name: 'divider', category: 'Custom', componentType: 'divider' },
  { label: 'Progress Bar', name: 'progress-bar', category: 'Custom', componentType: 'progress-bar' },
  { label: 'Slider', name: 'slider', category: 'Custom', componentType: 'slider' },
  { label: 'Header', name: 'header', category: 'Custom', componentType: 'header' },
  { label: 'Footer', name: 'footer', category: 'Custom', componentType: 'footer' },
  { label: 'Map', name: 'map', category: 'Custom', componentType: 'map' },
  { label: 'Contact form', name: 'form', category: 'Form', componentType: 'form' },
  { label: 'Newsletter', name: 'newsletter', category: 'Form', componentType: 'newsletter' },
  { label: 'Checkout', name: 'checkout', category: 'Commerce', componentType: 'checkout' },
  { label: 'Pricing', name: 'pricing', category: 'Commerce', componentType: 'pricing' },
  { label: 'Testimonials', name: 'testimonials', category: 'Social proof', componentType: 'testimonials' },
  { label: 'Logo wall', name: 'logos', category: 'Social proof', componentType: 'logos' },
  { label: 'Team', name: 'team', category: 'Sections', componentType: 'team' },
  { label: 'Blog list', name: 'blog', category: 'Content', componentType: 'blog' },
  { label: 'Image', name: 'image', category: 'Media', componentType: 'image' },
  { label: 'Video', name: 'video', category: 'Media', componentType: 'video' },
  {
    label: 'Input',
    name: 'Input',
    category: 'Form',
    componentType: 'inputElement',
    formElement: { type: 'text', name: 'input1', label: 'Textfield', placeholder: 'Enter your text...' },
  },
  {
    label: 'Checkbox',
    name: 'Checkbox',
    category: 'Form',
    componentType: 'inputElement',
    formElement: { type: 'checkbox', name: 'checkbox1', label: 'Checkbox' },
  },
  {
    label: 'Radio',
    name: 'Radio',
    category: 'Form',
    componentType: 'inputElement',
    formElement: { type: 'radio', name: 'radio1', label: 'Radio' },
  },
  {
    label: 'Select',
    name: 'Dropdown',
    category: 'Form',
    componentType: 'dropdown',
    formElement: {
      name: 'select1',
      label: 'Dropdown',
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
    },
  },
  {
    label: 'Textarea',
    name: 'Textarea',
    category: 'Form',
    componentType: 'textarea',
    formElement: { name: 'textarea', label: 'Textarea', placeholder: 'Enter your text...' },
  },
];

/** User entries replace defaults with the same `name`; new names are appended. */
export function mergeComponents(user: ComponentOption[] | undefined): ComponentOption[] {
  if (!user?.length) return [...defaultComponents];
  const byName = new Map(defaultComponents.map((c) => [c.name, c]));
  user.forEach((c) => byName.set(c.name, c));
  return [...byName.values()];
}
