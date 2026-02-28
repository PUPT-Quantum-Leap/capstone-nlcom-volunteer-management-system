const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.spec.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir('servetrack-frontend/src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('test-setup')) {
    const dir = path.dirname(file);
    let relative = path.relative(dir, 'servetrack-frontend/src/test-setup');
    if (!relative.startsWith('.')) relative = './' + relative;
    content = `import '${relative}';\n` + content;
    fs.writeFileSync(file, content);
  }
});
