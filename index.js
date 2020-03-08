const printf = require('printf')
const Redis = require('ioredis')

const redisHost = process.env.REDIS_HOST || '127.0.0.1'
const redis = new Redis({
  host: redisHost
})

const stringKeys = []
const setKeys = []

async function getKeys() {
  const keys = await redis.keys('*')
  return keys
}

async function getAll(keys) {
  for (let i = 0; i < keys.length; ++i) {
    await getKeyValues(keys[i])
  }
}

async function getKeyValues(key) {
  const type = await redis.type(key)
  if (type === 'string') {
    const value = await redis.get(key)
    const ttl = await redis.ttl(key)
    stringKeys.push([ key, type, value, ttl ])
  } else if (type === 'set') {
    const members = await redis.smembers(key)
    setKeys.push([ key, type, members ])
  } else {
    console.log('not set or string', key, type)
  }
}

function dump() {
  if (! process.env.DUMP) {
    return
  }

  stringKeys.forEach(elt => {
    const [ key, type, value, ttl ] = elt
    printf(process.stdout, '%-16s -> %-8s -> %8s -> %s\n', key, type, ttl, value)
  })

  setKeys.forEach(elt => {
    const [ key, type, members ] = elt
    printf(process.stdout, '%-16s -> %-8s -> %s\n', key, type, members)
  })
}

function analyze() {
  printf(process.stdout, 'sets: %d, strings: %d\n', setKeys.length, stringKeys.length)
  const setKeysHash = {}
  const stringKeysHash = {}

  setKeys.forEach(elt => {
    const [ key, type, members ] = elt
    if (setKeysHash[key]) {
      throw new Error('Huh? set ' + key)
    }
    setKeysHash[key] = members
  })

  let totalTTL = 0
  stringKeys.forEach(elt => {
    const [ key, type, value, ttl ] = elt
    if (stringKeysHash[key]) {
      throw new Error('Huh? string ' + key)
    }
    totalTTL += ttl
    stringKeysHash[key] = value
  })
  printf(process.stdout, 'average ttl: %d\n', totalTTL / stringKeys.length)

  if (process.env.DUMP) {
    console.log(JSON.stringify(setKeysHash, null, 2))
    console.log(JSON.stringify(stringKeysHash, null, 2))
  }

  let setMembersCount = 0
  let setMembersLiveCount = 0
  let setMembersDeadCount = 0
  let setsWithNoReferences = 0

  Object.keys(setKeysHash).forEach(key => {
    const setMembers = setKeysHash[key]
    setMembersCount += setMembers.length
    let setHasNoReferences = true
    setMembers.forEach(member => {
      if (stringKeysHash[member]) {
        setHasNoReferences = false
        setMembersLiveCount += 1
      } else {
        setMembersDeadCount += 1
      }
    })

    if (setHasNoReferences) {
      setsWithNoReferences += 1
    }
  })

  printf(process.stdout,
	       'setMembersCount: %d, setMembersLiveCount: %d, setMembersDeadCount: %d, setsWithNoReferences: %d\n',
         setMembersCount, setMembersLiveCount, setMembersDeadCount, setsWithNoReferences)
}

async function main() {
  const keys = await getKeys()
  await getAll(keys)

  analyze()
  dump()

  redis.disconnect()
}

main()
