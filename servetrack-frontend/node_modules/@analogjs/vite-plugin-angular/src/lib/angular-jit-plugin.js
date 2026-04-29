import { preprocessCSS } from 'vite';
export function jitPlugin({ inlineStylesExtension, }) {
    let config;
    return {
        name: '@analogjs/vite-plugin-angular-jit',
        configResolved(_config) {
            config = _config;
        },
        resolveId(id) {
            if (id.startsWith('virtual:angular')) {
                return `\0${id}`;
            }
            return;
        },
        async load(id) {
            if (id.includes('virtual:angular:jit:style:inline;')) {
                const styleId = id.split('style:inline;')[1];
                const decodedStyles = Buffer.from(decodeURIComponent(styleId), 'base64').toString();
                let styles = '';
                try {
                    const compiled = await preprocessCSS(decodedStyles, `${styleId}.${inlineStylesExtension}?direct`, config);
                    styles = compiled?.code;
                }
                catch (e) {
                    console.error(`${e}`);
                }
                return `export default \`${styles}\``;
            }
            return;
        },
    };
}
//# sourceMappingURL=angular-jit-plugin.js.map