export default (editor, opts = {}) => {
  const bm = editor.BlockManager;
  opts.components.forEach((component) => {
    let componentType = component?.componentType || 'Text'
    switch(componentType) {
      case 'faq': {
        bm.add('faq-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            type:'text',
            content:`
          <style>
            .faq-section {
              font-family: Arial, sans-serif;
              border: 1px solid #ccc;
              padding: 10px;
              background-color: #f7f7f7;
            }
            .faq-question {
              font-weight: bold;
              color: #333;
              cursor: pointer;
              padding: 5px;
            }
            .faq-answer {
              display: none;
              padding: 10px;
            }
            .faq-item.open .faq-answer {
              display: block;
            }
          </style>
          <div class="faq-section">
            <div class="faq-item">
              <div class="faq-question">Question 1: What is [Company/Product/Service Name]?</div>
              <div class="faq-answer">[Answer goes here]</div>
            </div>
          </div>
        `}
        });
        break;
      }
      case 'heading':{
        bm.add('heading-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            tagName:'h1',
            type:'text',
            content:`
            <h1>This ia a heading block</h1>
        `}
        });
        break;
      }
      case 'paragraph':{
        bm.add('paragraph-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            tagName:'p',
            type:'text',
            content:`
            <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.</p>
        `}
        });
        break;
      }
      default:
        return;
    }})
}
