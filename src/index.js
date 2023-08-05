import loadComponents from './components';
import loadBlocks from './blocks';
import grapesjs from "grapesjs";
import en from './locale/en';

export default grapesjs.plugins.add("AdvancedComponents",(editor, opts = {}) => {
  const options = { ...{
    components: [
      {
        visible:true,
        label:'Faq',
        name:'faq',
        category:'Text',
        type:'text',
        componentType:'faq',
      },
      {
        visible:true,
        label:'Heading',
        name:'heading',
        category:'Text',
        type:'text',
        componentType:'heading',
      },
      {
        visible:true,
        label:'Paragraph',
        name:'paragraph',
        category:'Text',
        type:'text',
        componentType:'paragraph',
      },
      {
        visible:true,
        label:'List',
        name:'list',
        category:'Text',
        type:'list',
        componentType:'list',
      },
      {
        visible:true,
        label:'Divider',
        name:'divider',
        category:'Custom',
        type:'divider',
        componentType:'divider',
      },
      {
        visible:true,
        label:'Map',
        name:'map',
        category:'Custom',
        type:'map',
        componentType:'map',
      },
      {
        visible:true,
        label:'Countdown',
        name:'countdown',
        category:'Custom',
        type:'countdown',
        componentType:'countdown',
      },
      {
        visible:true,
        label:'Image',
        name:'image',
        category:'Media',
        type:'image',
        componentType:'image',
      },
      {
        visible:true,
        label:'Video',
        name:'video',
        category:'Media',
        type:'video',
        componentType:'video',
      },
      {
        visible:true,
        label:'Button',
        name:'button',
        category:'Custom',
        type:'button',
        componentType:'button',
      },
      {
        visible:true,
        label:'Image Feature',
        name:'Image Feature',
        category:'Custom',
        type:'imageFeature',
        componentType:'imageFeature',
      },
      {
        visible:true,
        label:'Tab',
        name:'tab',
        category:'Custom',
        type:'tab',
        componentType:'tab',
      },
      {
        visible:true,
        label:'Form',
        name:'form',
        category:'Custom',
        type:'form',
        componentType:'form',
      },
      {
        visible:true,
        label:'Checkout',
        name:'checkout',
        category:'Custom',
        type:'checkout',
        componentType:'checkout',
      },
      {
        visible:true,
        label:'Slider',
        name:'slider',
        category:'Custom',
        type:'slider',
        componentType:'slider',
      },
      {
        visible:true,
        label:'Header',
        name:'header',
        category:'Custom',
        type:'header',
        componentType:'header',
      },
      {
        visible:true,
        label:'Footer',
        name:'footer',
        category:'Custom',
        type:'footer',
        componentType:'footer',
      },
      {
        visible:true,
        label:'Quote',
        name:'quote',
        category:'Custom',
        type:'text',
        componentType:'quote',
      },
      {
        visible:true,
        label:'Progress Bar',
        name:'Progress Bar',
        category:'Custom',
        type:'progress-bar',
        componentType:'progress-bar',
      },
      {
        visible:true,
        label:'Link',
        name:'link',
        category:'Custom',
        type:'link',
        componentType:'link',
      },
      {
        visible:true,
        label:'Icon',
        name:'icon',
        category:'Custom',
        type:'icon',
        componentType:'icon',
      },
      {
        visible:true,
        label:'Checkbox',
        name:'Checkbox',
        category:'Form',
        type:'input',
        componentType:'inputElement',
        formElement:{
          type:'checkbox',
          name:'checkbox1',
          label:'Checkbox',
          placeholder:'Pick the correct option'
        }
      },
      {
        visible:true,
        label:'Radio',
        name:'Radio',
        category:'Form',
        type:'input',
        componentType:'inputElement',
        formElement:{
          type:'radio',
          name:'radio1',
          label:'Radio',
          placeholder:'Pick the correct option'
        }
      },
      {
        visible:true,
        label:'Input',
        name:'Input',
        category:'Form',
        type:'input',
        componentType:'inputElement',
        formElement:{
          type:'text',
          name:'input1',
          label:'Textfield',
          placeholder:'Enter your text...'
        }
      },
      {
        visible:true,
        label:'Select',
        name:'Dropdown',
        category:'Form',
        type:'dropdown',
        componentType:'dropdown',
        formElement:{
          type:'text',
          name:'select1',
          label:'Dropdown',
          options:[
            {label:'Option 1',value:'option1'},
            {label:'Option 2',value:'option2'},
            {label:'Option 3',value:'option3'}
          ]
        }
      },
      {
        visible:true,
        label:'Textarea',
        name:'Textarea',
        category:'Form',
        type:'textarea',
        componentType:'textarea',
        formElement:{
          type:'text',
          name:'textarea',
          label:'Textarea',
          placeholder:'Enter your text...',
          
        }
      },
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