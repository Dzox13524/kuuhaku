const request = require('request-promise-native')

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

async function generateRule34Links(tag) {
    var tags = tag.join('+')
    const urlImgTab = "https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&limit=1000&pid=".concat(1, "&tags=").concat(tags);
    const body = await request(urlImgTab)
    const body1 = body.split('<post')
    if(body1.length < 3) return 'no résult found'
    const int = getRandomInt(body1.length)
    if(int === 0) return generateRule34Links(tag)
    const body2 = body1[int].split('file_url=')[1].split('parent_id=')[0]
    return body2
}

module.exports = {
    rule34: generateRule34Links,
}
