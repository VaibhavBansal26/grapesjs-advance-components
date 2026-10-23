import { main } from './index';

main(process.argv.slice(2)).then((code) => {
  if (code >= 0) process.exit(code);
});
