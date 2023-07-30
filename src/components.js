export default (editor, opts = {}) => {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultView = defaultType.view;

  if (Array.isArray(opts.components)) {
    opts.components.forEach((component) => {
      let componentType = component?.componentType || 'Text'
      switch(componentType) {
        case 'faq':{
          domc.addType('faq-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("faq");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("faq")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'heading': {
          domc.addType('heading-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("heading block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("heading")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        default:
          return;
      }
      
    })
  }
};
