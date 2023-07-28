export default (editor, opts = {}) => {
  const bm = editor.BlockManager;
  bm.add('MY-BLOCK', {
    label: `
    <i class="fa fa-arrows-h"></i>
    <div class="gjs-block-label">
      ${opts.label}
    </div> 
    `,
    category: opts.category,
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
      <div class="faq-item">
        <div class="faq-question">Question 2: How can I get started with [Company/Product/Service Name]?</div>
        <div class="faq-answer">[Answer goes here]</div>
      </div>
    </div>
  `}
  });
}
