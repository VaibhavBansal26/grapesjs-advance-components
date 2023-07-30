# Grapesjs Advance Components

[DEMO](##)
> **Provide a live demo of your plugin**
https://jsfiddle.net/vaibhavbansal26/jdxvcr3y/2/


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
More components and block will be added soon.
* Components
    * `Faq`
    * `Heading`
    * `Paragraph`
* Blocks
    * `faq-block`
    * `heading-block`
    * `paragraph-block`
    * ...



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
      components:[
         components:[ {
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
            }
            {
              visible:true,
              label:'Paragraph',
              name:'paragraph',
              category:'Custom',
              type:'text',
              componentType:'paragraph',
            }
          ]
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
