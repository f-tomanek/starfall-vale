/**
 * Player comfort and bookkeeping:
 * - desktop mouse-drag look (IWSDK ships WASD movement but no mouse look)
 * - seated mode height offset in VR
 * - zone detection (fog color, ambience), the Mist boundary with a fade
 * - fades, autosave, audio listener
 */
import { BackSide, Color, LocomotionSystem, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3, createSystem, type Fog } from '@iwsdk/core';
import { regionAt } from '../world/heightfield.js';
import { immersive, rt, saveNow, t, viewer } from '../runtime.js';

const SEATED_OFFSET = 0.45;
const AUTOSAVE_SECONDS = 60;

export class PlayerSystem extends createSystem({}) {
  private static instance: PlayerSystem | null = null;
  private yawDelta = 0;
  private pitch = 0;
  private dragging = false;
  private dragMoved = 0;
  private fadeMesh!: Mesh;
  private fadeAlpha = 0;
  private fadeTarget = 0;
  private fadeMid: (() => void) | null = null;
  private lastValid = new Vector3();
  private validTimer = 0;
  private outsideTimer = 0;
  private autosave = AUTOSAVE_SECONDS;
  private fogTarget = new Color();
  private tmp = new Vector3();
  private fwd = new Vector3();
  private up = new Vector3();
  private quat = new Quaternion();

  init(): void {
    PlayerSystem.instance = this;
    // Fade sphere around the camera (a mesh, not post-processing).
    this.fadeMesh = new Mesh(
      new SphereGeometry(0.3, 12, 8),
      new MeshBasicMaterial({ color: 0x000000, side: BackSide, transparent: true, opacity: 0, depthTest: false, fog: false }),
    );
    this.fadeMesh.renderOrder = 999;
    this.fadeMesh.visible = false;
    this.camera.add(this.fadeMesh);
    rt.fade = (mid) => {
      this.fadeMid = mid;
      this.fadeTarget = 1;
      this.fadeMesh.visible = true;
    };

    const canvas = this.renderer.domElement;
    const onDown = (e: PointerEvent) => {
      if (immersive()) return;
      this.dragging = true;
      this.dragMoved = 0;
      rt.audio.unlock();
      void e;
    };
    const onMove = (e: PointerEvent) => {
      if (!this.dragging || immersive()) return;
      this.dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
      this.yawDelta -= e.movementX * 0.0045;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.0045));
    };
    const onUp = () => (this.dragging = false);
    const noMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('contextmenu', noMenu);
    this.cleanupFuncs.push(() => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('contextmenu', noMenu);
    });
    const fog = this.scene.fog as Fog | null;
    if (fog) this.fogTarget.copy(fog.color);
  }

  /** Teleport the player (feet position) and optionally set the facing. */
  static teleport(pos: Vector3, yawDeg?: number): void {
    const loco = rt.world.getSystem(LocomotionSystem);
    loco?.setPlayerPosition(pos);
    rt.world.player.position.copy(pos);
    if (yawDeg !== undefined) rt.world.player.rotation.set(0, (yawDeg * Math.PI) / 180, 0);
    // A deliberate move (lift, load) into an open area is the new safe spot, so the
    // fall check does not pull the player back to where they came from.
    const self = PlayerSystem.instance;
    const zones = rt.content.world.zones;
    const open = regionAt(pos.x, pos.z, zones, (id) => rt.game.check(zones.find((z) => z.id === id)?.openWhen)) !== null;
    if (self && open) {
      self.lastValid.copy(pos);
      self.validTimer = 0.5;
      self.outsideTimer = 0;
    }
  }

  update(delta: number): void {
    const dt = Math.min(delta, 0.1);
    const player = this.player;

    // Desktop look: yaw rotates the player rig, pitch tilts the camera.
    if (!immersive()) {
      if (this.yawDelta !== 0) {
        player.rotation.y += this.yawDelta;
        this.yawDelta = 0;
      }
      // Arrow-free turning for keyboard users: Q / R rotate.
      const kb = this.input.keyboard;
      if (kb.getKeyPressed('KeyQ')) player.rotation.y += dt * 1.8;
      if (kb.getKeyPressed('KeyR')) player.rotation.y -= dt * 1.8;
      this.camera.rotation.set(this.pitch, 0, 0, 'YXZ');
    } else if (rt.settings.seated) {
      player.position.y += SEATED_OFFSET;
    }

    // Fade animation
    if (this.fadeMesh.visible) {
      this.fadeAlpha += Math.sign(this.fadeTarget - this.fadeAlpha) * dt * 3.5;
      this.fadeAlpha = Math.min(1, Math.max(0, this.fadeAlpha));
      (this.fadeMesh.material as MeshBasicMaterial).opacity = this.fadeAlpha;
      if (this.fadeAlpha >= 1 && this.fadeMid) {
        const mid = this.fadeMid;
        this.fadeMid = null;
        mid();
        this.fadeTarget = 0;
      } else if (this.fadeAlpha <= 0 && this.fadeTarget === 0) {
        this.fadeMesh.visible = false;
      }
    }

    // Audio listener follows the eyes.
    const eye = viewer();
    eye.getWorldPosition(this.tmp);
    eye.getWorldDirection(this.fwd);
    if (eye !== this.camera) this.fwd.negate();
    this.up.set(0, 1, 0).applyQuaternion(eye.getWorldQuaternion(this.quat));
    rt.audio.setListener(this.tmp, this.fwd, this.up);
    rt.audio.tick(dt);

    if (rt.mode !== 'play') return;

    // Zones and the Mist (closed zones and off-road areas turn the player back)
    const px = player.position.x;
    const pz = player.position.z;
    const groundY = player.position.y - (immersive() && rt.settings.seated ? SEATED_OFFSET : 0);
    const zones = rt.content.world.zones;
    const region = regionAt(px, pz, zones, (id) => rt.game.check(zones.find((z) => z.id === id)?.openWhen));
    if (region && region !== rt.zone) {
      rt.zone = region;
      const def = zones.find((z) => z.id === region);
      if (def) {
        this.fogTarget.set(def.fog);
        rt.audio.setZone(def.ambience);
      }
    }
    const fog = this.scene.fog as Fog | null;
    if (fog) fog.color.lerp(this.fogTarget, dt * 0.5);

    // Falling off a floating island also counts as leaving safe ground.
    const fell = groundY < this.lastValid.y - 4;
    if (region !== null && !fell) {
      this.outsideTimer = 0;
      this.validTimer -= dt;
      if (this.validTimer <= 0) {
        this.lastValid.copy(player.position);
        this.lastValid.y = groundY;
        this.validTimer = 0.5;
      }
    } else if (!this.fadeMesh.visible) {
      this.outsideTimer += dt;
      if (this.outsideTimer > (fell ? 0.15 : 0.4)) {
        this.outsideTimer = 0;
        if (!fell) rt.ui.toast(t('toast_mist'));
        const back = this.lastValid.clone();
        rt.fade(() => PlayerSystem.teleport(back));
      }
    }

    // Bookkeeping + autosave
    const s = rt.game.state;
    s.playSeconds += dt;
    s.player = {
      position: [player.position.x, player.position.y - (immersive() && rt.settings.seated ? SEATED_OFFSET : 0), player.position.z],
      yawDeg: (player.rotation.y * 180) / Math.PI,
    };
    this.autosave -= dt;
    if (this.autosave <= 0) {
      this.autosave = AUTOSAVE_SECONDS;
      saveNow(false);
    }
  }
}
