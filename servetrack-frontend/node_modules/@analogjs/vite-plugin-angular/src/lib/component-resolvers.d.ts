export declare class StyleUrlsResolver {
    private readonly styleUrlsCache;
    resolve(code: string, id: string): string[];
}
export declare function getStyleUrls(code: string): string[];
export declare function getTemplateUrls(code: string): string[];
export declare class TemplateUrlsResolver {
    private readonly templateUrlsCache;
    resolve(code: string, id: string): string[];
}
