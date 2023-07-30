import loadComponents from './components';
import loadBlocks from './blocks';
import grapesjs from "grapesjs";
import en from './locale/en';

export default grapesjs.plugins.add("AdvancedComponents",(editor, opts = {}) => {
  const options = { ...{
    components: [
      {
        visible:true,
        label:'FAQ',
        name:'faq',
        category:'Custom',
        type:'text',
        componentType:'faq',
      },
      {
        visible:true,
        label:'Heading',
        name:'heading',
        category:'Custom',
        type:'text',
        componentType:'heading',
      },
      {
        visible:true,
        label:'Paragraph',
        name:'paragraph',
        category:'Custom',
        type:'text',
        componentType:'paragraph',
      }
    ],
    i18n: {},
    // default options
  },  ...opts };

  if (opts.components) {
    for (const component of options.components) {
      const { name } = component;
      const matchingComponent = opts.components.find((cmp) => cmp.name === name);
      if (!matchingComponent) {
        opts.components.push(component);
      }
    }
  } else {
    opts.components = [...options.components];
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