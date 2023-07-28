export default (editor, opts = {}) => {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultView = defaultType.view;


  domc.addType('MY-COMPONENT', {
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
          type: opts.name,
        };
      }
    },
    view: {}
  });
};
