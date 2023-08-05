# Grapesjs Advance Components

[DEMO](https://jsfiddle.net/vaibhavbansal26/jdxvcr3y/2/)
<!-- > **Provide a live demo of your plugin** -->



### HTML
```html
<link href="https://unpkg.com/grapesjs/dist/css/grapes.min.css" rel="stylesheet">
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-advance-components"></script>

<div id="gjs"></div>
```

### JS
```js
const editor = grapesjs.init({
	container: '#gjs',
  height: '100%',
  fromElement: true,
  storageManager: false,
  plugins: ['grapesjs-advance-components'],
});
```

### CSS
```css
body, html {
  margin: 0;
  height: 100%;
}
```


## Summary

* Plugin name: `grapesjs-advance-components`
More components and blocks will be added soon with more advance features.

| No. | Component                                                                                           | Block               |
|-----|-----------------------------------------------------------------------------------------------------|---------------------|
| 1.  | Faq                                                                                                 | faq-block           |
| 2.  | Heading (h1, h2, h3, h4, h5, h6)                                                                    | heading-block       |
| 3.  | Paragraph                                                                                           | paragraph-block     |
| 4.  | List                                                                                                | list-block          |
| 5.  | Link                                                                                                | link-block          |
| 6.  | Image                                                                                               | image-block         |
| 7.  | Video                                                                                               | video-block         |
| 8.  | Progress Bar                                                                                        | progress-bar-block  |
| 9.  | Input                                                                                               | input-block         |
| 10. | Dropdown                                                                                            | dropdown-block      |
| 11. | Textarea                                                                                            | textarea-block      |
| 12. | Map                                                                                                 | map-block           |
| 13. | Divider                                                                                             | divider-block       |
| 14. | Button                                                                                              | button-block        |
| 15. | Slider                                                                                              | slider-block        |
Supported Input types (color, date, datetime-local, email, file, hidden, image, month, number, password, radio, range, reset, search, submit, tel, text, time, url, week, checkbox)



## Download

* CDN
  * `https://unpkg.com/grapesjs-advance-components`
* NPM
  * `npm i grapesjs-advance-components`
* GIT
  * `git clone https://github.com/VaibhavBansal26/grapesjs-advance-components.git`



## Usage

Directly in the browser
```html
<link href="https://unpkg.com/grapesjs/dist/css/grapes.min.css" rel="stylesheet"/>
<script src="https://unpkg.com/grapesjs"></script>
<script src="path/to/grapesjs-advance-components.min.js"></script>

<div id="gjs"></div>

<script type="text/javascript">
  var editor = grapesjs.init({
      container: '#gjs',
      // ...
      plugins: ['grapesjs-advance-components'],
      pluginsOpts: {
        'grapesjs-advance-components': { /* options */ }
      }
  });
</script>
```

Modern javascript
```js
import grapesjs from 'grapesjs';
import plugin from 'grapesjs-advance-components';
import 'grapesjs/dist/css/grapes.min.css';

const editor = grapesjs.init({
  container : '#gjs',
  // ...
  plugins: [plugin],
  pluginsOpts: {
    [plugin]: { 
          components:[ {
              visible:true,
              label:'Faq',
              name:'faq',
              category:'Custom',
              type:'text',
              componentType:'faq',
            },
            {
              visible:true,
              label:'Heading 6',
              name:'heading',
              category:'Text',
              type:'text',
              componentType:'heading',
              headingType:'h6'
            },
            {
              visible:true,
              label:'Heading 1',
              name:'heading',
              category:'Text',
              type:'text',
              componentType:'heading',
              headingType:'h1'
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
              type:'text',
              componentType:'list',
            },
            {
              visible:true,
              label:'Link',
              name:'link',
              category:'Text',
              type:'link',
              componentType:'link',
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
              label:'Divider',
              name:'divider',
              category:'Custom',
              type:'divider',
              componentType:'divider',
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
              placeholder:'Enter your text...',
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
              name:'select1',
              label:'Textarea',
              placeholder:'Enter your text...',
              
            }
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
            label:'Progress Bar',
            name:'Progress Bar',
            category:'Custom',
            type:'progress-bar',
            componentType:'progress-bar',
          },
          {
            visible:true,
            label:'Button',
            name:'button',
            category:'Custom',
            type:'button',
            componentType:'button',
            buttonElement:{
              buttonText:'Submit Now!'
            }
          },
          {
            visible:true,
            label:'Slider',
            name:'slider',
            category:'Custom',
            type:'slider',
            componentType:'slider',
          },
          ]
     }
  }
  // or
  plugins: [
    editor => plugin(editor, { /* options */ }),
  ],
});
```



## Development

Clone the repository

```sh
$ git clone https://github.com/VaibhavBansal26/grapesjs-advance-components.git
$ cd grapesjs-advance-components
```

Install dependencies

```sh
$ npm i
```

Start the dev server

```sh
$ npm start
```

Build the source

```sh
$ npm run build
```



## License

MIT
