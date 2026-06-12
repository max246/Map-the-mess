// jsdom does not provide TextEncoder/TextDecoder, which react-router v7 needs at
// import time. Loaded via jest `setupFiles` so it runs before any test module imports.
const { TextEncoder, TextDecoder } = require('util')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}
