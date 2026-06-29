import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_PICK } from '../constants.js';

/**
 * @import { BindGroup } from '../../platform/graphics/bind-group.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 */

const _meshInstances = [];
const _lights = [[], [], []];
const _defaultShadowAtlasParams = new Float32Array(2);

/**
 * Immediate render pass that draws a single gsplat render-address pick mesh instance into an
 * offscreen RGBA8 target via renderForward(SHADER_PICK). Mirrors the uniform setup of the
 * framework {@link RenderPassPicker} (camera uniforms, global lights, view bind groups) but
 * renders exactly one supplied mesh instance instead of filtering scene layers. Executed
 * directly via {@link RenderPass#render} so a readback immediately after returns this pass's
 * result rather than a future frame's.
 *
 * @ignore
 */
class RenderPassGSplatRasterPick extends RenderPass {
    /** @type {BindGroup[]} */
    viewBindGroups = [];

    /** @type {BlendState} */
    blendState = BlendState.NOBLEND;

    /** @type {object} */
    camera;

    /** @type {MeshInstance|null} */
    meshInstance = null;

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {ForwardRenderer} renderer - The forward renderer used to draw the pick mesh instance.
     */
    constructor(device, renderer) {
        super(device);
        this.renderer = renderer;
    }

    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    /**
     * @param {object} camera - The internal Camera to pick from (the gsplat pick convention:
     * the framework picker calls director.prepareForPicking(camera.camera, ...), so by the
     * time the camera reaches the unified pipeline it is the internal Camera, NOT the
     * CameraComponent).
     * @param {MeshInstance} meshInstance - The render-address pick mesh instance to draw.
     */
    update(camera, meshInstance) {
        this.camera = camera;
        this.meshInstance = meshInstance;
    }

    execute() {
        const device = this.device;
        const { renderer, camera, meshInstance, renderTarget } = this;
        if (!meshInstance) return;

        DebugGraphics.pushGpuMarker(device, 'GSplatRasterPick');

        const scene = renderer.scene;

        // Upload clustered lights uniforms (the forward view format includes them even though
        // the pick pass does not use them — mirrors RenderPassPicker).
        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
        if (clusteredLightingEnabled) {
            renderer.worldClustersAllocator.empty.activate();
        }

        renderer.setCameraUniforms(camera, renderTarget);

        renderer.dispatchGlobalLights(scene);
        device.scope.resolve('shadowAtlasParams').setValue(_defaultShadowAtlasParams);

        if (device.supportsUniformBuffers) {
            renderer.initViewBindGroupFormat(clusteredLightingEnabled);
            renderer.setupViewUniformBuffers(this.viewBindGroups, renderer.viewUniformFormat, renderer.viewBindGroupFormat, null);
        }

        _meshInstances.push(meshInstance);
        renderer.renderForward(camera, renderTarget, _meshInstances, _lights, SHADER_PICK, () => {
            device.setBlendState(this.blendState);
        });
        _meshInstances.length = 0;

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassGSplatRasterPick };
