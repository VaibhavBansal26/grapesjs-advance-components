import loadComponents from './components';
import loadBlocks from './blocks';
import grapesjs from "grapesjs";
import en from './locale/en';

export default grapesjs.plugins.add("faqComponent",(editor, opts = {}) => {
  const options = { ...{
    label:'FAQ',
    name:'faq',
    category:'Custom',
    type:'text',
    i18n: {},
    // default options
  },  ...opts };

  for (let name in options) {
    if (!(name in opts)) opts[name] = options[name];
  }

  // Add components
  loadComponents(editor, options);
  // Add blocks
  loadBlocks(editor, options);
  // Load i18n files
  editor.I18n && editor.I18n.addMessages({
      en,
      ...options.i18n,
  });

});