import type Phaser from 'phaser';
import { ui } from '../art/palette';
import { Tex } from '../keys';
import { addLabel } from '../ui/text';
import { Depth } from './fx';
import { layout } from './layout';

interface Point {
  x: number;
  y: number;
}

export type TutorialGesture =
  | { kind: 'tap'; at: Point }
  | { kind: 'drag'; from: Point; to: Point }
  | { kind: 'swipe'; from: Point; to: Point };

const PANEL_W = 680;

export class TutorialView {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly finger: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Arc;
  private text = '';
  private gestureKey = '';
  private timeline: Phaser.Tweens.TweenChain | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.box = scene.add.rectangle(0, 0, PANEL_W, 96, ui.panel, 0.94).setStrokeStyle(4, 0x7ed957);
    this.label = addLabel(scene, 0, 0, '', 28, ui.text).setWordWrapWidth(PANEL_W - 40);
    this.panel = scene.add
      .container(layout.width / 2, 0, [this.box, this.label])
      .setDepth(Depth.Hint + 1)
      .setVisible(false);
    this.ring = scene.add
      .circle(0, 0, 34)
      .setStrokeStyle(5, 0xfff06a, 1)
      .setDepth(Depth.Float + 1)
      .setVisible(false);
    this.finger = scene.add
      .image(0, 0, Tex.Finger)
      .setOrigin(0.525, 0.06)
      .setDepth(Depth.Float + 2)
      .setVisible(false);
  }

  show(text: string, y: number): void {
    if (text !== this.text) {
      this.text = text;
      this.label.setText(text);
      this.box.setSize(PANEL_W, Math.max(84, this.label.height + 30));
      this.box.setOrigin(0.5);
      this.panel.setScale(0.9).setAlpha(0).setVisible(true);
      this.scene.tweens.add({
        targets: this.panel,
        scale: 1,
        alpha: 1,
        duration: 220,
        ease: 'Back.easeOut',
      });
    }
    this.panel.setY(y);
  }

  point(gesture: TutorialGesture | null): void {
    const key = gesture ? JSON.stringify(gesture, (_k, v: unknown) => roundValue(v)) : '';
    if (key === this.gestureKey) return;
    this.gestureKey = key;
    this.stopTimeline();
    if (!gesture) return;
    this.finger.setVisible(true).setAlpha(0).setScale(1);
    if (gesture.kind === 'tap') this.playTap(gesture.at);
    else this.playMove(gesture.from, gesture.to, gesture.kind === 'swipe');
  }

  hide(): void {
    this.point(null);
    if (!this.panel.visible || this.text === '') return;
    this.text = '';
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        if (this.text === '') this.panel.setVisible(false);
      },
    });
  }

  destroy(): void {
    this.stopTimeline();
    this.panel.destroy();
    this.finger.destroy();
    this.ring.destroy();
  }

  private playTap(at: Point): void {
    this.finger.setPosition(at.x + 14, at.y + 26);
    this.ring.setPosition(at.x, at.y);
    this.timeline = this.scene.tweens.chain({
      targets: this.finger,
      loop: -1,
      tweens: [
        { alpha: 1, duration: 160 },
        { x: at.x, y: at.y, scale: 0.88, duration: 220, ease: 'Quad.easeIn' },
        {
          scale: 1,
          duration: 160,
          onStart: () => this.pulse(),
        },
        { x: at.x + 14, y: at.y + 26, duration: 260, ease: 'Quad.easeOut' },
        { alpha: 1, duration: 300 },
      ],
    });
  }

  private playMove(from: Point, to: Point, swipe: boolean): void {
    this.finger.setPosition(from.x, from.y);
    this.ring.setPosition(from.x, from.y);
    const travel = swipe ? 420 : 900;
    this.timeline = this.scene.tweens.chain({
      targets: this.finger,
      loop: -1,
      tweens: [
        { x: from.x, y: from.y, alpha: 1, scale: 1, duration: 200 },
        { scale: 0.88, duration: 150, onStart: () => this.pulse() },
        { x: to.x, y: to.y, duration: travel, ease: 'Sine.easeInOut' },
        ...(swipe
          ? [
              { x: from.x, y: from.y, duration: travel, ease: 'Sine.easeInOut' },
              { x: to.x, y: to.y, duration: travel, ease: 'Sine.easeInOut' },
            ]
          : []),
        { scale: 1, duration: 140 },
        { alpha: 0, duration: 240, delay: 120 },
        { alpha: 0, duration: 260 },
      ],
    });
  }

  private pulse(): void {
    this.ring.setPosition(this.finger.x, this.finger.y).setVisible(true).setScale(0.4).setAlpha(1);
    this.scene.tweens.add({ targets: this.ring, scale: 1.4, alpha: 0, duration: 420 });
  }

  private stopTimeline(): void {
    this.timeline?.stop();
    this.timeline?.destroy();
    this.timeline = null;
    this.scene.tweens.killTweensOf(this.ring);
    this.finger.setVisible(false);
    this.ring.setVisible(false);
  }
}

function roundValue(value: unknown): unknown {
  return typeof value === 'number' ? Math.round(value / 8) : value;
}
