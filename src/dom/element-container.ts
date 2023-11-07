import {CSSParsedDeclaration} from '../css/index';
import {TextContainer} from './text-container';
import {Bounds, parseBounds} from '../css/layout/bounds';
import {isHTMLElementNode} from './node-parser';
import {Context} from '../core/context';
import {DebuggerType, isDebugging} from '../core/debugger';
import {isTransparent, parseColor} from '../css/types/color';
import {backgroundImage} from '../css/property-descriptors/background-image';
import {Tokenizer} from '../css/syntax/tokenizer';
import {Parser} from '../css/syntax/parser';

export const enum FLAGS {
    CREATES_STACKING_CONTEXT = 1 << 1,
    CREATES_REAL_STACKING_CONTEXT = 1 << 2,
    IS_LIST_OWNER = 1 << 3,
    DEBUG_RENDER = 1 << 4
}

export class ElementContainer {
    readonly styles: CSSParsedDeclaration;
    readonly textNodes: TextContainer[] = [];
    readonly elements: ElementContainer[] = [];
    bounds: Bounds;
    flags = 0;

    constructor(protected readonly context: Context, element: Element) {
        if (isDebugging(element, DebuggerType.PARSE)) {
            debugger;
        }

        const declaration = window.getComputedStyle(element, null);
        this.styles = new CSSParsedDeclaration(context, declaration);
        const style = this.parseBackgroundImage(context, element, declaration);
        if (declaration.backgroundImage != style && !!style && style != 'none') {
            const tokenizer = new Tokenizer();
            const value = typeof style !== 'undefined' ? style.toString() : backgroundImage.initialValue;
            tokenizer.write(value);
            const parser = new Parser(tokenizer.read());
            this.styles.backgroundImage = backgroundImage.parse(context, parser.parseComponentValues());
        }

        if (isHTMLElementNode(element)) {
            if (this.styles.animationDuration.some((duration) => duration > 0)) {
                element.style.animationDuration = '0s';
            }

            if (this.styles.transform !== null) {
                // getBoundingClientRect takes transforms into account
                element.style.transform = 'none';
            }
        }

        this.bounds = parseBounds(this.context, element);

        if (isDebugging(element, DebuggerType.RENDER)) {
            this.flags |= FLAGS.DEBUG_RENDER;
        }
    }

    parseBackgroundImage = (context: Context, element: Element, styles: CSSStyleDeclaration): string => {
        let backgroundImage = '';
        if (styles.getPropertyValue('-webkit-background-clip') === 'text') {
            const fillColor = parseColor(context, styles.getPropertyValue('-webkit-text-fill-color'));
            const bgImage = styles['backgroundImage'];
            const bgColor = parseColor(context, styles['backgroundColor']);
            if (isTransparent(fillColor) && (!bgImage || bgImage == 'none') && isTransparent(bgColor)) {
                let parent = element.parentElement;
                while (parent != null) {
                    const parentStyles = window.getComputedStyle(parent, null);
                    const parentBgImage = parentStyles['backgroundImage'];
                    if (!!parentBgImage && parentBgImage != 'none') {
                        backgroundImage = parentStyles['backgroundImage'];
                        break;
                    }
                    parent = parent.parentElement;
                }
            }
        }
        return backgroundImage;
    };
}
