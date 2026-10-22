import { expect } from 'chai';

import { platform } from '../../../src/core/platform.js';
import { XrManager } from '../../../src/framework/xr/xr-manager.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('XrManager', function () {

    let app;
    let browser;
    let listeners;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();

        // a browser with WebXR, whose navigator.xr counts its devicechange listeners
        browser = platform.browser;
        platform.browser = true;
        listeners = new Set();
        Object.defineProperty(navigator, 'xr', {
            configurable: true,
            value: {
                addEventListener: (type, listener) => type === 'devicechange' && listeners.add(listener),
                removeEventListener: (type, listener) => type === 'devicechange' && listeners.delete(listener),
                isSessionSupported: () => new Promise(() => {})
            }
        });
    });

    afterEach(function () {
        delete navigator.xr;
        platform.browser = browser;
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#destroy', function () {

        it('removes the devicechange listener it added to navigator.xr', function () {
            const xr = new XrManager(app);
            expect(listeners.size).to.equal(1);

            xr.destroy();
            expect(listeners.size).to.equal(0);
        });

    });

});
