const printf = require('printf')
const Redis = require('ioredis')

const redisHost = process.env.REDIS_HOST || '127.0.0.1'
const redis = new Redis({
  host: redisHost
})


async function getKeys() {
  const keys = await redis.keys('*')
  return keys
}

async function printKeyValue(key) {
  const type = await redis.type(key)
  if (type === 'string') {
    const value = await redis.get(key)
    printf(process.stdout, '%-16s -> %-8s -> %s\n', key, type, value)
  } else {
    const members = await redis.smembers(key)
    printf(process.stdout, '%-16s -> %-8s -> %s\n', key, type, members)
  }
}

function shutdown() {
  process.exit(0)
}

async function main() {
  const keys = await getKeys()
  console.log(keys)
  keys.forEach(async key => {
    await printKeyValue(key)
  })
  setTimeout(shutdown, 2000)
}

main()
