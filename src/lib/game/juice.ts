export class Juice {
  trauma = 0;
  impact = 0;
  squash = 1;
  flash = 0;
  reduced = false;
  shakeOn = true;
  time = 0;
  offsetX = 0;
  offsetY = 0;

  apply({ reduced, shake }: { reduced: boolean; shake: boolean }) {
    this.reduced = reduced;
    this.shakeOn = shake;
    if (reduced || !shake) {
      this.trauma = 0;
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  addTrauma(v: number) {
    if (this.reduced || !this.shakeOn) return;
    this.trauma = Math.min(1, this.trauma + v);
  }

  hit(kind: "lock" | "hard" | "clear" | "tetris") {
    if (this.reduced) {
      this.flash = Math.max(this.flash, 0.15);
      return;
    }
    if (kind === "lock") {
      this.impact = 1;
      this.squash = 0.94;
    } else if (kind === "hard") {
      this.impact = 1;
      this.squash = 0.9;
      this.addTrauma(0.18);
    } else if (kind === "clear") {
      this.flash = 0.35;
      this.addTrauma(0.12);
    } else {
      this.flash = 0.55;
      this.addTrauma(0.42);
    }
  }

  update(dt: number) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 2.6);
    this.impact = Math.max(0, this.impact - dt * 9);
    this.flash = Math.max(0, this.flash - dt * 4.5);
    this.squash += (1 - this.squash) * (1 - Math.exp(-18 * dt));
    const shake = this.trauma * this.trauma;
    if (shake > 0.001) {
      const t = this.time * 29;
      this.offsetX = Math.sin(t * 1.7) * shake * 5.5;
      this.offsetY = Math.cos(t * 1.9) * shake * 4.2;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }
}
