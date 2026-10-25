const crypto = require('crypto')
const b = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const h = b({ alg: 'HS256', typ: 'JWT' }), p = b({ role: 'service_role' })
console.log(`${h}.${p}.${crypto.createHmac('sha256', 'local-test-secret-local-test-secret-1234').update(`${h}.${p}`).digest('base64url')}`)
