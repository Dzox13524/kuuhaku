# hentai-db

Get hot 2d porn! (based on `konachan.com`)

## installation

```bash
yarn add hentai-db
```

## usage

```javascript
const hentaiDb = require('hentai-db')

async function run () {
  const pic = await hentaiDb.getImage({ tags: ['yuri'] })
  console.log(`here's your random hentai! ${pic}`)
}

run().catch(console.error)
```

## documentation

`getImage(options)`
* `options`
* * `tags` array `(default [])`

note: tags are based on `konachan.com` tags
