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
```html
<table>
  <tr>
    <th>No.</th>
    <th>Component</th>
    <th>Block</th>
  </tr>
  <tr>
    <td>1.</td>
    <td>Faq</td>
    <td>faq-block</td>
  </tr>
   <tr>
    <td>2.</td>
    <td>Heading (h1,h2,h3,h4,h5,h6)</td>
    <td>heading-block</td>
  </tr>
   <tr>
    <td>3.</td>
    <td>Paragraph</td>
    <td>paragraph-block</td>
  </tr>
   <tr>
    <td>4.</td>
    <td>List</td>
    <td>list-block</td>
  </tr>
   <tr>
    <td>5.</td>
    <td>Link</td>
    <td>link-block</td>
  </tr>
   <tr>
    <td>6.</td>
    <td>Image</td>
    <td>image-block</td>
  </tr>
   <tr>
    <td>7.</td>
    <td>Video</td>
    <td>video-block</td>
  </tr>
   <tr>
    <td>8.</td>
    <td>Progress Bar</td>
    <td>progress-bar-block</td>
  </tr>
   <tr>
    <td>9.</td>
    <td>Input (color,date,datetime-local,email,file,hidden,image,month,number,password,radio,range,reset,search,submit,tel,text,time,url,week,checkbox)</td>
    <td>input-block</td>
  </tr>
   <tr>
    <td>10.</td>
    <td>Dropdown</td>
    <td>dropdown-block</td>
  </tr>
   <tr>
    <td>11.</td>
    <td>Textarea</td>
    <td>textarea-block</td>
  </tr>
   <tr>
    <td>12.</td>
    <td>Map</td>
    <td>map-block</td>
  </tr>
   <tr>
    <td>13.</td>
    <td>Divider</td>
    <td>divider-block</td>
  </tr>
   <tr>
    <td>14.</td>
    <td>Button</td>
    <td>button-block</td>
  </tr>
   <tr>
    <td>14.</td>
    <td>Slider</td>
    <td>slider-block</td>
  </tr>
  </table>
```



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
