const getStream = require('get-stream');
const { Readable } = require('stream');

async function test() {
  const stream = Readable.from(['hello world']);
  const buf = await getStream.buffer(stream);
  console.log(buf.toString()); // should print 'hello world'
}
test();