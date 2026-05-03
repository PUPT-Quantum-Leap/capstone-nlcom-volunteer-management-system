const fs = require('fs');
const content = fs.readFileSync('c:\\capstone-nlcom-volunteer-management-system\\servetrack-frontend\\src\\app\\admin-dashboard\\admin-dashboard.scss', 'utf8');
let depth = 0;
let lastClosed = -1;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            lastClosed = i + 1;
            if (depth < 0) {
                console.log('Unmatched } at line ' + (i + 1));
                process.exit(1);
            }
        }
    }
}
console.log('Final depth: ' + depth);
