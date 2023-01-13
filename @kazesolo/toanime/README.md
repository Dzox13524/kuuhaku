# @kazesolo/ToAnime!



## Installation

    npm i --save @kazesolo/ToAnime


## Example


Transform an image from an url

```js
const anime = require('@kazesolo/ToAnime');

anime.transform({
    photo: 'https://media.gq.com.mx/photos/5e220ec2ffa8c7000803441e/16:9/w_1920,c_limit/40-datos-curiosos-para-descubrir-a-scarlett-johansson.jpg',
   
    destinyFolder: './images'
})
.then(data => {
    console.log('Image', data);
})
.catch(err => {
    console.log('Error', err);
});

```

Transform a local image and get image in base64

```js
const anime = require('@kazesolo/ToAnime');
const path = require('path');

anime.transform({
    photo: path.join(__dirname, './image.jpg')
})
.then(data => {
    console.log('Image in base64', data);
})
.catch(err => {
    console.log('Error', err);
});

```

Result
```js
{
    "image": "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODww...", // image in base64
    "url": "https://act-artifacts.shadowcv.qq.com/mqq/ai_painting_anime/res/f812533e4d2e197fecaa91c5bf1f89d_244kg.jpg"
}
```
