const hentaiDB = require('./index').rule34


async function getPic() {
    const img = await hentaiDB(['toy'])
    console.log(img)
}

getPic()