export default (editor, opts = {}) => {
  const bm = editor.BlockManager;
  const tm = editor.TraitManager;
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
        let headingTag = ['h1','h2','h3','h4','h5','h6']?.includes(component?.headingType) ? component?.headingType :'h1'
        bm.add(`heading-${headingTag}-block`, {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            tagName: headingTag,
            type:'text',
            content:`This ia a heading ${headingTag} block`
          }
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
      case 'list':{
        bm.add('list-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            tagName:'ul',
            type:'text',
            components:[
              {
                type:'text',
                tagName:'li',
                content:'List Item 1'
              },
              {
                type:'text',
                tagName:'li',
                content:'List Item 2'
              },
              {
                type:'text',
                tagName:'li',
                content:'List Item 3'
              },
              {
                type:'text',
                tagName:'li',
                content:'List Item 4'
              }
            ],
            }
        });
        break;
      }
      case 'link':{
        bm.add('link-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            type:'link',
            components:[
              {
                tagName:'a',
                content:'Link'
              }
            ]
          }
        });
        break;
      }
      case 'image':{
        bm.add('image-block', {
          label: `
          <i class="fa fa-image"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{
            type:'image',
            src:'',
          }
        });
        break;
      }
      case 'video':{
        bm.add('video-block', {
          label: `
          <i class="fa fa-file-video-o"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{ 
            type:'video',
            traits:[
              {
                label:'Video Url',
                type:"text",
                name:'src',
                changeProp:1,
            },
            {
              label:'Title',
              type:"text",
              name:'title',
              changeProp:1,
          }
            ]
          }
        });
        break;
      }
      case 'divider':{
        bm.add('divider-block', {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content:{
            type:'divider',
            content:`<style>.dividerClass {
              height:1px;
              border-top:1px solid;
              border-bottom-width:0px;
              border-left-width:0px;
              border-right-width:0px;
            }</style><div name="divider" class="dividerClass"></div>`
          }
        });
        break;
      }
      case 'inputElement':{
        const inputElementType = ["color","date","datetime-local","email","file","hidden","image","month","number","password","radio","range","reset","search","submit","tel","text","time","url","week","checkbox"]?.includes(component?.formElement?.type) ? component?.formElement?.type : 'text'
        const {name,placeholder,label,id} = component?.formElement || {}
        bm.add(`input-element-${inputElementType}-block`, {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content: {
            type:'text',
            content:`
            <div class="input-block">
              <label for="input-block-field">${label || 'Label :'}</label>
              <input id="input-block-field" type="${inputElementType}" id="${id || label}" name="${name || ''}" placeholder="${placeholder || 'Enter your text here'}">
            </div>
          `,
          }
        });
        break;
      }
      case 'dropdown':{
        const { label, id, name, placeholder, options } = component.formElement || {};
        const optionsHTML = options
          ? options
              .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
              .join('')
          : '';
        bm.add(`dropdown-block`, {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content: {
            type:'text',
            content: `
                <div class="input-block">
                  <label for="input-block-field">${label || 'Label :'}</label>
                  <select id="input-block-field" id="${id || label}" name="${name || ''}" placeholder="${placeholder || 'Enter your text here'}">
                    ${optionsHTML}
                  </select>
                </div>
              `
          }
        });
        break;
      }
      case 'textarea': {
        const {name,placeholder,label,id} = component?.formElement || {}
        bm.add(`textarea-block`, {
          label: `
          <i class="fa fa-arrows-h"></i>
          <div class="gjs-block-label">
            ${component.label}
          </div> 
          `,
          category: component.category,
          content: {
            type:'text',
            content:`
            <div class="input-block">
              <label for="input-block-field">${label || 'Label :'}</label>
              <textarea id="input-block-field" id="${id || label}" name="${name || ''}" placeholder="${placeholder || 'Enter your text here'}"></textarea>
            </div>
          `,
          }
        });
        break;
      }
     case 'map':{
      bm.add(`map-block`, {
        label: `
        <i class="fa fa-arrows-h"></i>
        <div class="gjs-block-label">
          ${component.label}
        </div> 
        `,
        category: component.category,
        content: {
          type:'map',
          name:'Map'
        ,
        }
      });
      break;
     }
     case 'progress-bar':{
      const style = `<style>
        .progressContainer {
          width: 100%;
          height: 70px;
          background-color: #ededed;
          overflow: hidden;
          position: relative;
          margin: 0px auto;
      }
      .progressInner {
          display: flex;
          align-items: center;
          padding: 0px 8px;
          height: 100%;
          text-wrap:nowrap;
          position: absolute;
      }</style>`
      tm.addType('progressColor', {
        createInput({ trait }) {
          const el = document.createElement('div');
          el.innerHTML = `<input type="color" name="progress_color"/></div>`
          return el;
        },
        onEvent({ elInput, component, event }) {
          const progressPercentage = component.get('progressPercentage');
          const progressColor = component.get('progressColor');
          let progress_color = '#000000';
          if (event.target.value) {
            progress_color = event.target.value
          }
          const processedContent = `${style}
            <div class="progressContainer">
              <div class="progressInner" style="width: ${progressPercentage || 65}%; background-color: ${progress_color || progressColor ||'#f1c40f'};">
              </div>
            </div>
          `;
          console.log("process",processedContent)
          component.view.el.querySelector('.progressInner').style['background-color'] = progressColor || progress_color;
          component.view.model.set('progressColor',progress_color)
          component.set('content', processedContent);
        }, // onEvent
        // Updates the trait area UI based on what is in the component.
        onUpdate({ elInput, component }) {
            component.listenTo(component, 'change:progressPercentage', (component,e) => {
              console.log("cmp",component)
              const progressPercentage = component.get('progressPercentage') || e;
              const progressColor = component.get('progressColor') || component.attributes?.progressColor ||component.getTrait('progressColor')?.value;
              const processedContent = `${style}
              <div class="progressContainer">
                <div class="progressInner" style="width: ${progressPercentage || 65}%; background-color: ${progressColor || '#f1c40f'};">
                </div>
              </div>
            `;
            component.view.el.querySelector('.progressInner').style['width'] = `${progressPercentage}%`;
            component.set('content', processedContent);
            });
        },
    })
      bm.add(`progress-bar-block`, {
        label: `
        <i class="fa fa-arrows-h"></i>
        <div class="gjs-block-label">
          ${component.label}
        </div> 
        `,
        category: component.category,
        content: {
          content:`${style}<div class="progressContainer">
          <div class="progressInner"
          style="width:65%;background-color:#f1c40f;"></div>
      </div>`
        ,
        traits: [
          {
            type: "text",
            name: "progressPercentage",
            label: "Progress Percentage",
            changeProp: 1,
          },
          {
            type: "progressColor",
            name: "progressColor",
            label: "Progress Color",
            changeProp: 1,
          },
        ],
        },
      });
      break;
     }
     case 'button':{
      const {buttonText="Click Here",handleClick} = component.buttonElement || {}
      console.log("handle",handleClick)
      bm.add(`button-block`, {
        label: `
        <i class="fa fa-arrows-h"></i>
        <div class="gjs-block-label">
          ${component.label}
        </div> 
        `,
        category: component.category,
        content: {
          script: function(props) {
            const btn = this;
            this.addEventListener('click', () => {
             console.log("clicked");
            });
          },
          tagName:'button',
          content:`${buttonText}`,
        },
      });
      break;
     }
     case 'slider': {
      bm.add(`slider-block`,{
        label: `
        <i class="fa fa-arrows-h"></i>
        <div class="gjs-block-label">
          ${component.label}
        </div> 
        `,
        category:component.category,
        content:{
          type:'text',
          content:`
          <style>
          .content-slider {
            width: 100%;
            height: 360px;
          }
          .slider {
            height: 320px;
            width: 680px;
            margin: 40px auto 0;
            overflow: visible;
            position: relative;
          }
          .mask {
            overflow: hidden;
            height: 320px;
            width: 680px;
          }
          .slider ul {
            margin: 0;
            padding: 0;
            position: relative;
            width: 3400px; /* 680px * number of slides */
          }
          .slider li {
            width: 680px;
            height: 320px;
            position: absolute;
            left: 680px;
            list-style: none;
          }
          .slider .quote {
            font-size: 40px;
            font-style: italic;
          }
          .slider .source {
            font-size: 20px;
            text-align: right;
          }
          .slider li:hover {
            -webkit-animation-play-state: paused;
            animation-play-state: paused;}
          .slider ul:hover {
              -webkit-animation-play-state: paused;
              animation-play-state: paused;
          }
          .slider li.anim1 {
            -webkit-animation: cycle1 45s linear infinite;
            animation: cycle1 45s linear infinite;
          }
          .slider li.anim2 {
            -webkit-animation: cycle2 45s linear infinite;
            animation: cycle2 45s linear infinite;
          }
          .slider li.anim3 {
            -webkit-animation: cycle3 45s linear infinite;
            animation: cycle3 45s linear infinite;
          }
          .slider li.anim4 {
            -webkit-animation: cycle4 45s linear infinite;
            animation: cycle4 45s linear infinite;
          }
          .slider li.anim5 {
            -webkit-animation: cycle5 45s linear infinite;
            animation: cycle5 45s linear infinite;
          }
          @keyframes cycle1 {
            0%, 20% {
              left: 0px;
              opacity: 1;
            }
            24%, 100% {
              left: -680px;
              opacity: 0;
            }
          }
          @keyframes cycle2 {
            0%, 20% {
              left: 680px;
              opacity: 0;
            }
            24%, 40% {
              left: 0px;
              opacity: 1;
            }
            44%, 100% {
              left: -680px;
              opacity: 0;
            }
          }
          @keyframes cycle3 {
            0%, 40% {
              left: 680px;
              opacity: 0;
            }
            44%, 60% {
              left: 0px;
              opacity: 1;
            }
            64%, 100% {
              left: -680px;
              opacity: 0;
            }
          }
          @keyframes cycle4 {
            0%, 60% {
              left: 680px;
              opacity: 0;
            }
            64%, 80% {
              left: 0px;
              opacity: 1;
            }
            84%, 100% {
              left: -680px;
              opacity: 0;
            }
          }
          @keyframes cycle5 {
            0%, 80% {
              left: 680px;
              opacity: 0;
            }
            84%, 100% {
              left: 0px;
              opacity: 1;
            }
          }          
          </style>
          <div class="content-slider">
          <div class="slider">
            <div class="mask">
              <ul>
                <li class="anim1">
                <img src="" />
                  <div class="quote">This is another quote from another person.</div>
                  <div class="source">- Another Person</div>
                </li>
                <li class="anim2">
                  <div class="quote">This is another quote from another person.</div>
                  <div class="source">- Another Person</div>
                </li>
                <li class="anim3">
                  <div class="quote">Yet another quote from yet another person.</div>
                  <div class="source">- Yet Another Person</div>
                </li>
                <li class="anim4">
                  <div class="quote">This is a fourth quote from a fourth person.</div>
                  <div class="source">- Fourth Person</div>
                </li>
                <li class="anim5">
                  <div class="quote">This is a fifth quote from a fifth person.</div>
                  <div class="source">- Fifth Person</div>
                </li>
              </ul>
            </div>
          </div>
        </div>`
        }
      })
     }
      default:
        return;
    }})
}
