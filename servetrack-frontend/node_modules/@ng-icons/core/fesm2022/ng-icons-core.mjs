import * as i0 from '@angular/core';
import { InjectionToken, inject, input, numberAttribute, booleanAttribute, computed, ChangeDetectionStrategy, Component, Injector, Renderer2, PLATFORM_ID, ElementRef, effect, HostAttributeToken, runInInjectionContext, Inject, NgModule } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { isObservable } from 'rxjs';

const NgGlyphConfigToken = new InjectionToken('Ng Glyph Config');
const defaultConfig = {
    size: '1em',
    opticalSize: 20,
    weight: 400,
    grade: 0,
    fill: false,
};
/**
 * Provide the configuration for the glyph
 * @param config The configuration to use
 */
function provideNgGlyphsConfig(config) {
    return {
        provide: NgGlyphConfigToken,
        useValue: { ...defaultConfig, ...config },
    };
}
/**
 * Inject the configuration for the glyphs
 * @returns The configuration to use
 * @internal
 */
function injectNgGlyphsConfig() {
    return (inject(NgGlyphConfigToken, { optional: true }) ??
        defaultConfig);
}

const NgGlyphsToken = new InjectionToken('NgGlyphsToken');
function provideNgGlyphs(...glyphsets) {
    // if there are no glyphsets, throw an error
    if (!glyphsets.length) {
        throw new Error('Please provide at least one glyphset.');
    }
    // the default glyphset is the first one
    const defaultGlyphset = glyphsets[0].name;
    return [{ provide: NgGlyphsToken, useValue: { defaultGlyphset, glyphsets } }];
}
function injectNgGlyphs() {
    const glyphs = inject(NgGlyphsToken, { optional: true });
    if (!glyphs) {
        throw new Error('Please provide the glyphs using the provideNgGlyphs() function.');
    }
    return glyphs;
}

function coerceCssPixelValue(value) {
    return value == null ? '' : /^\d+$/.test(value) ? `${value}px` : value;
}

class NgGlyph {
    constructor() {
        /**
         * Access the available glyphsets
         */
        this.glyphsets = injectNgGlyphs();
        /**
         * Access the default configuration
         */
        this.config = injectNgGlyphsConfig();
        /**
         * Define the name of the glyph to display
         */
        this.name = input.required(...(ngDevMode ? [{ debugName: "name" }] : []));
        /**
         * Define the glyphset to use
         */
        this.glyphset = input(this.glyphsets.defaultGlyphset, ...(ngDevMode ? [{ debugName: "glyphset" }] : []));
        /**
         * Define the optical size of the glyph
         */
        this.opticalSize = input(this.config.opticalSize, ...(ngDevMode ? [{ debugName: "opticalSize", transform: numberAttribute }] : [{
                transform: numberAttribute,
            }]));
        /**
         * Define the weight of the glyph
         */
        this.weight = input(this.config.weight, ...(ngDevMode ? [{ debugName: "weight", transform: numberAttribute }] : [{ transform: numberAttribute }]));
        /**
         * Define the grade of the glyph
         */
        this.grade = input(this.config.grade, ...(ngDevMode ? [{ debugName: "grade", transform: numberAttribute }] : [{ transform: numberAttribute }]));
        /**
         * Define the fill of the glyph
         */
        this.fill = input(this.config.fill, ...(ngDevMode ? [{ debugName: "fill", transform: booleanAttribute }] : [{ transform: booleanAttribute }]));
        /**
         * Define the size of the glyph
         */
        this.size = input(this.config.size, ...(ngDevMode ? [{ debugName: "size", transform: coerceCssPixelValue }] : [{ transform: coerceCssPixelValue }]));
        /**
         * Define the color of the glyph
         */
        this.color = input(this.config.color, ...(ngDevMode ? [{ debugName: "color" }] : []));
        /**
         * Derive the glyphset class from the glyphset name
         */
        this.glyphsetClass = computed(() => {
            const glyphset = this.glyphsets.glyphsets.find(glyphset => glyphset.name === this.glyphset());
            if (!glyphset) {
                throw new Error(`The glyphset "${this.glyphset()}" does not exist. Please provide a valid glyphset.`);
            }
            return glyphset.baseClass;
        }, ...(ngDevMode ? [{ debugName: "glyphsetClass" }] : []));
        /**
         * Define the font variation settings of the glyph
         */
        this.fontVariationSettings = computed(() => {
            return `'FILL' ${this.fill() ? 1 : 0}, 'wght' ${this.weight()}, 'GRAD' ${this.grade()}, 'opsz' ${this.opticalSize()}`;
        }, ...(ngDevMode ? [{ debugName: "fontVariationSettings" }] : []));
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgGlyph, deps: [], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.1.0", version: "21.0.0", type: NgGlyph, isStandalone: true, selector: "ng-glyph", inputs: { name: { classPropertyName: "name", publicName: "name", isSignal: true, isRequired: true, transformFunction: null }, glyphset: { classPropertyName: "glyphset", publicName: "glyphset", isSignal: true, isRequired: false, transformFunction: null }, opticalSize: { classPropertyName: "opticalSize", publicName: "opticalSize", isSignal: true, isRequired: false, transformFunction: null }, weight: { classPropertyName: "weight", publicName: "weight", isSignal: true, isRequired: false, transformFunction: null }, grade: { classPropertyName: "grade", publicName: "grade", isSignal: true, isRequired: false, transformFunction: null }, fill: { classPropertyName: "fill", publicName: "fill", isSignal: true, isRequired: false, transformFunction: null }, size: { classPropertyName: "size", publicName: "size", isSignal: true, isRequired: false, transformFunction: null }, color: { classPropertyName: "color", publicName: "color", isSignal: true, isRequired: false, transformFunction: null } }, host: { properties: { "class": "glyphsetClass()", "textContent": "name()", "style.--ng-glyph__size": "size()", "style.color": "color()", "style.font-variation-settings": "fontVariationSettings()" } }, ngImport: i0, template: ``, isInline: true, styles: [":host{display:inline-block;width:var(--ng-glyph__size);height:var(--ng-glyph__size);font-size:var(--ng-glyph__size);overflow:hidden}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgGlyph, decorators: [{
            type: Component,
            args: [{ selector: 'ng-glyph', standalone: true, template: ``, changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[class]': 'glyphsetClass()',
                        '[textContent]': 'name()',
                        '[style.--ng-glyph__size]': 'size()',
                        '[style.color]': 'color()',
                        '[style.font-variation-settings]': 'fontVariationSettings()',
                    }, styles: [":host{display:inline-block;width:var(--ng-glyph__size);height:var(--ng-glyph__size);font-size:var(--ng-glyph__size);overflow:hidden}\n"] }]
        }], propDecorators: { name: [{ type: i0.Input, args: [{ isSignal: true, alias: "name", required: true }] }], glyphset: [{ type: i0.Input, args: [{ isSignal: true, alias: "glyphset", required: false }] }], opticalSize: [{ type: i0.Input, args: [{ isSignal: true, alias: "opticalSize", required: false }] }], weight: [{ type: i0.Input, args: [{ isSignal: true, alias: "weight", required: false }] }], grade: [{ type: i0.Input, args: [{ isSignal: true, alias: "grade", required: false }] }], fill: [{ type: i0.Input, args: [{ isSignal: true, alias: "fill", required: false }] }], size: [{ type: i0.Input, args: [{ isSignal: true, alias: "size", required: false }] }], color: [{ type: i0.Input, args: [{ isSignal: true, alias: "color", required: false }] }] } });

/**
 * Helper function to create an object that represents a feature.
 */
function createFeature(kind, providers) {
    return { ɵkind: kind, ɵproviders: providers };
}

const NgIconPreProcessorToken = new InjectionToken('Ng Icon Pre Processor');
const NgIconPostProcessorToken = new InjectionToken('Ng Icon Post Processor');
function injectNgIconPreProcessor() {
    return inject(NgIconPreProcessorToken, { optional: true }) ?? (icon => icon);
}
function injectNgIconPostProcessor() {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return inject(NgIconPostProcessorToken, { optional: true }) ?? (() => { });
}
function preprocessIcon(icon) {
    // rename all style attributes to data-style to avoid being blocked by the CSP
    return icon.replace(/style\s*=/g, 'data-style=');
}
function postprocessIcon(element) {
    // find all elements with a data-style attribute and get the styles from it
    // and apply them to the element using the style property and remove the data-style attribute
    const elements = element.querySelectorAll('[data-style]');
    for (const element of Array.from(elements)) {
        const styles = element.getAttribute('data-style');
        styles?.split(';').forEach(style => {
            const [property, value] = style.split(':');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            element.style[property.trim()] = value.trim();
        });
        element.removeAttribute('data-style');
    }
}
/**
 * Process icons in a way that is compliant with the content security policy
 */
function withContentSecurityPolicy() {
    return createFeature(0 /* NgIconFeatureKind.ContentSecurityPolicyFeature */, [
        { provide: NgIconPreProcessorToken, useValue: preprocessIcon },
        { provide: NgIconPostProcessorToken, useValue: postprocessIcon },
    ]);
}

const LoggerToken = new InjectionToken('Ng Icon Logger');
/**
 * The default logger implementation that logs to the console
 */
class DefaultLogger {
    log(message) {
        console.log(message);
    }
    warn(message) {
        console.warn(message);
    }
    error(message) {
        console.error(message);
    }
}
/**
 * A logger implementation that throws an error on warnings and errors
 */
class ExceptionLogger {
    log(message) {
        console.log(message);
    }
    warn(message) {
        throw new Error(message);
    }
    error(message) {
        throw new Error(message);
    }
}
function injectLogger() {
    return inject(LoggerToken, { optional: true }) ?? new DefaultLogger();
}
/**
 * Throw exceptions on warnings and errors
 */
function withExceptionLogger() {
    return createFeature(1 /* NgIconFeatureKind.ExceptionLoggerFeature */, [
        { provide: LoggerToken, useClass: ExceptionLogger },
    ]);
}

const NgIconConfigToken = new InjectionToken('Ng Icon Config');
/**
 * Provide the configuration for the icons
 * @param config The configuration to use
 */
function provideNgIconsConfig(config, ...features) {
    return [
        {
            provide: NgIconConfigToken,
            useValue: config,
        },
        features.map(feature => feature.ɵproviders),
    ];
}
/**
 * Inject the configuration for the icons
 * @returns The configuration to use
 * @internal
 */
function injectNgIconConfig() {
    return inject(NgIconConfigToken, { optional: true }) ?? {};
}

const NgIconLoaderToken = new InjectionToken('Ng Icon Loader Token');
/**
 * Helper function to create an object that represents a Loader feature.
 */
function loaderFeature(kind, providers) {
    return { kind: kind, providers: providers };
}
const NgIconCacheToken = new InjectionToken('Ng Icon Cache Token');
/**
 * Add caching to the loader. This will prevent the loader from being called multiple times for the same icon name.
 */
function withCaching() {
    return loaderFeature(0 /* NgIconLoaderFeatureKind.CachingFeature */, [
        { provide: NgIconCacheToken, useValue: new Map() },
    ]);
}
/**
 * Provide a function that will return the SVG content for a given icon name.
 * @param loader The function that will return the SVG content for a given icon name.
 * @param features The list of features to apply to the loader.
 * @returns The SVG content for a given icon name.
 */
function provideNgIconLoader(loader, ...features) {
    return [
        { provide: NgIconLoaderToken, useValue: loader },
        features.map(feature => feature.providers),
    ];
}
/**
 * Inject the function that will return the SVG content for a given icon name.
 */
function injectNgIconLoader() {
    return inject(NgIconLoaderToken, { optional: true });
}
/**
 * Inject the cache that will store the SVG content for a given icon name.
 */
function injectNgIconLoaderCache() {
    return inject(NgIconCacheToken, { optional: true });
}

/**
 * Define the icons to use
 * @param icons The icons to provide
 */
function provideIcons(icons) {
    return [
        {
            provide: NgIconsToken,
            useFactory: (parentIcons = inject(NgIconsToken, {
                optional: true,
                skipSelf: true,
            })) => ({
                ...parentIcons?.reduce((acc, icons) => ({ ...acc, ...icons }), {}),
                ...icons,
            }),
            multi: true,
        },
    ];
}
const NgIconsToken = new InjectionToken('Icons Token');
/**
 * Inject the icons to use
 * @returns The icons to use
 * @internal
 */
function injectNgIcons() {
    return inject(NgIconsToken, { optional: true }) ?? [];
}

/**
 * A loader may return a promise, an observable or a string. This function will coerce the result into a promise.
 * @returns
 */
function coerceLoaderResult(result) {
    if (typeof result === 'string') {
        return Promise.resolve(result);
    }
    if (isObservable(result)) {
        // toPromise is deprecated, but we can't use lastValueFrom because it's not available in RxJS 6
        // so for now we'll just use toPromise
        return result.toPromise();
    }
    return result;
}

/**
 * Hyphenated to lowerCamelCase
 */
function toPropertyName(str) {
    return str
        .replace(/([^a-zA-Z0-9])+(.)?/g, (_, __, chr) => chr ? chr.toUpperCase() : '')
        .replace(/[^a-zA-Z\d]/g, '')
        .replace(/^([A-Z])/, m => m.toLowerCase());
}

let uniqueId = 0;
class NgIcon {
    constructor() {
        /** Access the global icon config */
        this.config = injectNgIconConfig();
        /** Access the icons */
        this.icons = injectNgIcons();
        /** Access the icon loader if defined */
        this.loader = injectNgIconLoader();
        /** Access the icon cache if defined */
        this.cache = injectNgIconLoaderCache();
        /** Access the pre-processor */
        this.preProcessor = injectNgIconPreProcessor();
        /** Access the post-processor */
        this.postProcessor = injectNgIconPostProcessor();
        /** Access the injector */
        this.injector = inject(Injector);
        /** Access the renderer */
        this.renderer = inject(Renderer2);
        /** Determine the platform we are rendering on */
        this.platform = inject(PLATFORM_ID);
        /** Access the element ref */
        this.elementRef = inject(ElementRef);
        /** A unique id for this instance */
        this.uniqueId = uniqueId++;
        /** Access the logger */
        this.logger = injectLogger();
        /** Define the name of the icon to display */
        this.name = input(...(ngDevMode ? [undefined, { debugName: "name" }] : []));
        /** Define the svg of the icon to display */
        this.svg = input(...(ngDevMode ? [undefined, { debugName: "svg" }] : []));
        /** Define the size of the icon */
        this.size = input(this.config.size, ...(ngDevMode ? [{ debugName: "size", transform: coerceCssPixelValue }] : [{ transform: coerceCssPixelValue }]));
        /** Define the stroke-width of the icon */
        this.strokeWidth = input(this.config.strokeWidth, ...(ngDevMode ? [{ debugName: "strokeWidth" }] : []));
        /** Define the color of the icon */
        this.color = input(this.config.color, ...(ngDevMode ? [{ debugName: "color" }] : []));
        // update the icon anytime the name or svg changes
        effect(() => this.updateIcon());
        const ariaHidden = inject(new HostAttributeToken('aria-hidden'), {
            optional: true,
        });
        // If the user has not explicitly set aria-hidden, mark the icon as hidden, as this is
        // the right thing to do for the majority of icon use-cases.
        if (!ariaHidden) {
            this.elementRef.nativeElement.setAttribute('aria-hidden', 'true');
        }
    }
    ngOnDestroy() {
        this.svgElement = undefined;
    }
    async updateIcon() {
        const name = this.name();
        const svg = this.svg();
        // if the svg is defined, insert it into the template
        if (svg !== undefined) {
            this.setSvg(svg);
            return;
        }
        if (name === undefined) {
            return;
        }
        const propertyName = toPropertyName(name);
        for (const icons of [...this.icons].reverse()) {
            if (icons[propertyName]) {
                // insert the SVG into the template
                this.setSvg(icons[propertyName]);
                return;
            }
        }
        // if there is a loader defined, use it to load the icon
        if (this.loader) {
            const result = await this.requestIconFromLoader(name);
            // if the result is a string, insert the SVG into the template
            if (result !== null) {
                this.setSvg(result);
                return;
            }
        }
        // if there is no icon with this name warn the user as they probably forgot to import it
        this.logger.warn(`No icon named ${name} was found. You may need to import it using the withIcons function.`);
    }
    setSvg(svg) {
        // if we are on the server, simply innerHTML the svg as we don't have the
        // level of control over the DOM that we do on the client, in otherwords
        // the approach we take to insert the svg on the client will not work on the server
        if (isPlatformServer(this.platform)) {
            this.elementRef.nativeElement.innerHTML = svg;
            // mark this component as server side rendered
            this.elementRef.nativeElement.setAttribute('data-ng-icon-ssr', '');
            return;
        }
        // if this was previously server side rendered, we should check if the svg is the same
        // if it is, we don't need to do anything
        if (this.elementRef.nativeElement.hasAttribute('data-ng-icon-ssr')) {
            // if it is different, we need to remove the server side rendered flag
            this.elementRef.nativeElement.removeAttribute('data-ng-icon-ssr');
            // retrieve the svg element
            this.svgElement =
                this.elementRef.nativeElement.querySelector('svg') ??
                    undefined;
            if (this.elementRef.nativeElement.innerHTML === svg) {
                return;
            }
        }
        // remove the old element
        if (this.svgElement) {
            this.renderer.removeChild(this.elementRef.nativeElement, this.svgElement);
        }
        // if the svg is empty, don't insert anything
        if (svg === '') {
            return;
        }
        const template = this.renderer.createElement('template');
        svg = this.replaceIds(svg);
        this.renderer.setProperty(template, 'innerHTML', this.preProcessor(svg));
        this.svgElement = template.content.firstElementChild;
        this.postProcessor(this.svgElement);
        // insert the element into the dom
        this.renderer.appendChild(this.elementRef.nativeElement, this.svgElement);
    }
    replaceIds(svg) {
        // ids are defined like ID_PLACEHOLDER_0, ID_PLACEHOLDER_1, etc.
        // we need to replace these with the actual ids e.g. ng-icon-0-0, ng-icon-0-1, etc.
        // if there are no ids, we don't need to do anything
        if (!svg.includes('ID_PLACEHOLDER_')) {
            return svg;
        }
        // we can just retain the trailing number as the prefix is always the same
        const regex = /ID_PLACEHOLDER_(\d+)/g;
        // we need to keep track of the ids we have replaced
        const idMap = new Map();
        // find all the matches
        const matches = new Set(svg.match(regex));
        if (matches === null) {
            return svg;
        }
        // replace the ids
        for (const match of matches) {
            const id = match.replace('ID_PLACEHOLDER_', '');
            const placeholder = `ng-icon-${this.uniqueId}-${idMap.size}`;
            idMap.set(id, placeholder);
            svg = svg.replace(new RegExp(match, 'g'), placeholder);
        }
        return svg;
    }
    /**
     * Request the icon from the loader.
     * @param name The name of the icon to load.
     * @returns The SVG content for a given icon name.
     */
    requestIconFromLoader(name) {
        return new Promise(resolve => {
            runInInjectionContext(this.injector, async () => {
                // if we have a cache, check if the icon is already loaded (i.e, it is a string)
                if (this.cache) {
                    const cachedResult = this.cache.get(name);
                    if (typeof cachedResult === 'string') {
                        resolve(cachedResult);
                        return;
                    }
                    // it may be a promise, so we need to await it
                    if (cachedResult instanceof Promise) {
                        const result = await cachedResult;
                        resolve(result);
                        return;
                    }
                }
                const promise = coerceLoaderResult(this.loader(name));
                // store the promise in the cache so if we get repeated calls (e.g. in a loop) before the loader has resolved
                // then don't call the loader function multiple times
                this.cache?.set(name, promise);
                // await the result of the promise
                const result = await promise;
                // if we have a cache, store the result
                this.cache?.set(name, result);
                resolve(result);
            });
        });
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIcon, deps: [], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.1.0", version: "21.0.0", type: NgIcon, isStandalone: true, selector: "ng-icon", inputs: { name: { classPropertyName: "name", publicName: "name", isSignal: true, isRequired: false, transformFunction: null }, svg: { classPropertyName: "svg", publicName: "svg", isSignal: true, isRequired: false, transformFunction: null }, size: { classPropertyName: "size", publicName: "size", isSignal: true, isRequired: false, transformFunction: null }, strokeWidth: { classPropertyName: "strokeWidth", publicName: "strokeWidth", isSignal: true, isRequired: false, transformFunction: null }, color: { classPropertyName: "color", publicName: "color", isSignal: true, isRequired: false, transformFunction: null } }, host: { attributes: { "role": "img" }, properties: { "style.--ng-icon__stroke-width": "strokeWidth()", "style.--ng-icon__size": "size()", "style.--ng-icon__color": "color()" } }, ngImport: i0, template: '', isInline: true, styles: [":host{display:inline-block;width:var(--ng-icon__size, 1em);height:var(--ng-icon__size, 1em);line-height:initial;vertical-align:initial;overflow:hidden}:host ::ng-deep svg{width:inherit;height:inherit;vertical-align:inherit}@layer ng-icon{:host{color:var(--ng-icon__color, currentColor)}}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIcon, decorators: [{
            type: Component,
            args: [{ selector: 'ng-icon', template: '', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        role: 'img',
                        '[style.--ng-icon__stroke-width]': 'strokeWidth()',
                        '[style.--ng-icon__size]': 'size()',
                        '[style.--ng-icon__color]': 'color()',
                    }, styles: [":host{display:inline-block;width:var(--ng-icon__size, 1em);height:var(--ng-icon__size, 1em);line-height:initial;vertical-align:initial;overflow:hidden}:host ::ng-deep svg{width:inherit;height:inherit;vertical-align:inherit}@layer ng-icon{:host{color:var(--ng-icon__color, currentColor)}}\n"] }]
        }], ctorParameters: () => [], propDecorators: { name: [{ type: i0.Input, args: [{ isSignal: true, alias: "name", required: false }] }], svg: [{ type: i0.Input, args: [{ isSignal: true, alias: "svg", required: false }] }], size: [{ type: i0.Input, args: [{ isSignal: true, alias: "size", required: false }] }], strokeWidth: [{ type: i0.Input, args: [{ isSignal: true, alias: "strokeWidth", required: false }] }], color: [{ type: i0.Input, args: [{ isSignal: true, alias: "color", required: false }] }] } });

class NgIconsModule {
    constructor(icons) {
        if (Object.keys(icons).length === 0) {
            throw new Error('No icons have been provided. Ensure to include some icons by importing them using NgIconsModule.withIcons({ ... }).');
        }
    }
    /**
     * Define the icons that will be included in the application. This allows unused icons to
     * be tree-shaken away to reduce bundle size
     * @param icons The object containing the required icons
     */
    static withIcons(icons) {
        return { ngModule: NgIconsModule, providers: provideIcons(icons) };
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIconsModule, deps: [{ token: NgIconsToken }], target: i0.ɵɵFactoryTarget.NgModule }); }
    static { this.ɵmod = i0.ɵɵngDeclareNgModule({ minVersion: "14.0.0", version: "21.0.0", ngImport: i0, type: NgIconsModule, imports: [NgIcon], exports: [NgIcon] }); }
    static { this.ɵinj = i0.ɵɵngDeclareInjector({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIconsModule }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIconsModule, decorators: [{
            type: NgModule,
            args: [{
                    imports: [NgIcon],
                    exports: [NgIcon],
                }]
        }], ctorParameters: () => [{ type: undefined, decorators: [{
                    type: Inject,
                    args: [NgIconsToken]
                }] }] });
const NG_ICON_DIRECTIVES = [NgIcon];

class NgIconStack {
    constructor() {
        /** The size of the child icons */
        this.size = input.required(...(ngDevMode ? [{ debugName: "size" }] : []));
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIconStack, deps: [], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.1.0", version: "21.0.0", type: NgIconStack, isStandalone: true, selector: "ng-icon-stack", inputs: { size: { classPropertyName: "size", publicName: "size", isSignal: true, isRequired: true, transformFunction: null } }, host: { properties: { "style.--ng-icon__size": "size()" } }, ngImport: i0, template: '<ng-content />', isInline: true, styles: [":host{display:inline-flex;justify-content:center;align-items:center;position:relative;width:var(--ng-icon__size);height:var(--ng-icon__size)}:host ::ng-deep ng-icon{position:absolute}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "21.0.0", ngImport: i0, type: NgIconStack, decorators: [{
            type: Component,
            args: [{ selector: 'ng-icon-stack', standalone: true, template: '<ng-content />', changeDetection: ChangeDetectionStrategy.OnPush, host: {
                        '[style.--ng-icon__size]': 'size()',
                    }, styles: [":host{display:inline-flex;justify-content:center;align-items:center;position:relative;width:var(--ng-icon__size);height:var(--ng-icon__size)}:host ::ng-deep ng-icon{position:absolute}\n"] }]
        }], propDecorators: { size: [{ type: i0.Input, args: [{ isSignal: true, alias: "size", required: true }] }] } });

/**
 * Generated bundle index. Do not edit.
 */

export { NG_ICON_DIRECTIVES, NgGlyph, NgGlyphConfigToken, NgIcon, NgIconCacheToken, NgIcon as NgIconComponent, NgIconConfigToken, NgIconLoaderToken, NgIconStack, NgIconsModule, NgIconsToken, injectNgGlyphsConfig, injectNgIconConfig, injectNgIconLoader, injectNgIconLoaderCache, injectNgIcons, provideIcons, provideNgGlyphs, provideNgGlyphsConfig, provideNgIconLoader, provideNgIconsConfig, withCaching, withContentSecurityPolicy, withExceptionLogger };
//# sourceMappingURL=ng-icons-core.mjs.map
