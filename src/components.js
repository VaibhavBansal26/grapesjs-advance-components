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
          let headingTag = ['h1','h2','h3','h4','h5','h6']?.includes(component?.headingType) ? component?.headingType :'h1'
          domc.addType(`heading-${headingTag}-block`, {
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
        case 'paragraph': {
          domc.addType('paragraph-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("paragraph block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("paragraph")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'list': {
          domc.addType('list-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("list block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("list")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'link': {
          domc.addType('link-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("link block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("link")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'image': {
          domc.addType('image-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("image block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("image")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'video': {
          domc.addType('video-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("video block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("video")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'divider': {
          domc.addType('divider-block', {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("divider block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("divider")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'inputElement': {
          const inputElementType = ["color","date","datetime-local","email","file","hidden","image","month","number","password","radio","range","reset","search","submit","tel","text","time","url","week","checkbox"]?.includes(component?.formElement?.type) ? component?.formElement?.type : 'text'
          domc.addType(`input-element-${inputElementType}-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("form Element block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("inputElement")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'dropdown': {
          domc.addType(`dropdown-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("dropdown block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("dropdown")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'textarea': {
          domc.addType(`textarea-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("textarea block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("textarea")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'map': {
          domc.addType(`map-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("map block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("map")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'progress-bar': {
          domc.addType(`progress-bar-block`, {
            model: {
              defaults: {
                traits: [
                      {
                        type: "text",
                        name: "progressPercentage",
                        label: "Progress Percentage",
                        changeProp: 1,
                      },
                      {
                        type: "color",
                        name: "progressColor",
                        label: "Progress Color",
                        changeProp: 1,
                      },
                ],
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("progress-bar")) {
                return {
                  type: component.name,
                };
              }
            },
            view: defaultView.extend({
              init({ model }) {
                this.listenTo(model, "change:progressPercentage", this.updateScript);
                this.listenTo(model, "change:progressColor", this.updateScript);
              },
            }),
          });
          break;
        }
        case 'button': {
          domc.addType(`button-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("button block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("button")) {
                return {
                  type: component.name,
                };
              }
            },
            view: {}
          });
          break;
        }
        case 'slider': {
          domc.addType(`slider-block`, {
            model: {
              defaults: {
                traits: [],
                script: function () {
                    console.log("slider block");
                },
              },
            },
            isComponent: (el) => {
              if (el.className && el.className.includes("slider")) {
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
