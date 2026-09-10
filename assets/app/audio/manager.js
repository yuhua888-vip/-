export class AudioManager {
    context = null;
    master = null;
    ambient = null;
    music = null;
    effects = null;
    noise = null;
    lastPeek = 0;
    cues = new Set();
    duck = false;
    haptics = true;
    paper = null;
    settings = { master: .45, ambience: .2, music: .08, effects: .7, muted: false };
    async unlock() {
        try {
            if (!this.context) {
                this.context = new AudioContext();
                const c = this.context;
                this.master = c.createGain();
                this.master.connect(c.destination);
                this.effects = c.createGain();
                this.effects.connect(this.master);
                this.ambient = c.createGain();
                this.ambient.connect(this.master);
                this.music = c.createGain();
                this.music.connect(this.master);
                this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
                const data = this.noise.getChannelData(0);
                for (let i = 0; i < data.length; i++)
                    data[i] = Math.random() * 2 - 1;
                const room = c.createBufferSource();
                room.buffer = this.noise;
                room.loop = true;
                const filter = c.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 180;
                room.connect(filter);
                filter.connect(this.ambient);
                room.start();
                for (const frequency of [130.81, 196, 261.63]) {
                    const tone = c.createOscillator();
                    tone.type = 'sine';
                    tone.frequency.value = frequency;
                    const gain = c.createGain();
                    gain.gain.value = .018;
                    tone.connect(gain);
                    gain.connect(this.music);
                    tone.start();
                }
                this.update();
            }
            if (this.context.state === 'suspended')
                await this.context.resume();
        }
        catch { /* Audio is optional; denied audio must never block a hand. */ }
    }
    update() {
        if (!this.context || !this.master || !this.effects || !this.ambient || !this.music)
            return;
        const now = this.context.currentTime;
        this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, .04);
        this.effects.gain.setTargetAtTime(this.settings.effects, now, .04);
        this.ambient.gain.setTargetAtTime(this.settings.ambience * .045 * (this.duck ? .3 : 1), now, .08);
        this.music.gain.setTargetAtTime(this.settings.music * (this.duck ? .15 : 1), now, .08);
    }
    focusPeek(active) { this.duck = active; this.update(); }
    suspend() { this.stopPaper(); void this.context?.suspend().catch(() => { }); }
    haptic(kind) {
        if (this.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate(kind === 'threshold' ? 12 : kind === 'chip' ? 7 : 4);
            }
            catch { /* optional */ }
        }
    }
    paperCue(kind, milliseconds) {
        const c = this.context, output = this.effects;
        if (!c || !output || !this.noise || c.state !== 'running' || this.settings.muted)
            return;
        const node = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
        node.buffer = this.noise;
        node.loop = true;
        const character = { draw: [1700, .033], travel: [650, .009], land: [480, .068], slide: [1150, .025], lift: [1450, .02] }[kind];
        filter.type = kind === 'land' ? 'lowpass' : 'bandpass';
        filter.frequency.value = character[0];
        filter.Q.value = .65;
        const now = c.currentTime, duration = Math.max(.045, milliseconds / 1000);
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(character[1], now + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        node.playbackRate.value = kind === 'slide' ? .7 : 1;
        node.connect(filter);
        filter.connect(gain);
        gain.connect(output);
        node.start();
        node.stop(now + duration);
        const cue = { source: node, gain };
        this.cues.add(cue);
        node.onended = () => { this.cues.delete(cue); node.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    cancelPresentation() { this.stopPaper(); const now = this.context?.currentTime; if (now === undefined)
        return; for (const cue of this.cues) {
        cue.gain.gain.cancelScheduledValues(now);
        cue.gain.gain.setTargetAtTime(0, now, .012);
        try {
            cue.source.stop(now + .05);
        }
        catch { /* already stopped */ }
    } }
    /** One persistent noise voice per gesture; velocity changes timbre, not node count. */
    rub(velocity) {
        const c = this.context;
        if (!c || !this.effects || !this.noise || c.state !== 'running')
            return;
        if (!this.paper) {
            const source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
            source.buffer = this.noise;
            source.loop = true;
            filter.type = 'bandpass';
            filter.Q.value = .8;
            gain.gain.value = 0;
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.effects);
            source.start();
            this.paper = { source, gain, filter };
        }
        const speed = Math.min(1, Math.abs(velocity) / 900), now = c.currentTime;
        this.paper.gain.gain.setTargetAtTime(speed * .045, now, .025);
        this.paper.source.playbackRate.setTargetAtTime(.5 + speed * 1.15, now, .04);
        this.paper.filter.frequency.setTargetAtTime(600 + speed * 2100, now, .04);
    }
    stopPaper() {
        const paper = this.paper;
        if (!paper || !this.context)
            return;
        this.paper = null;
        paper.gain.gain.setTargetAtTime(0, this.context.currentTime, .025);
        paper.source.stop(this.context.currentTime + .12);
        paper.source.onended = () => { paper.source.disconnect(); paper.gain.disconnect(); paper.filter.disconnect(); };
    }
    play(sound) {
        const c = this.context, output = this.effects;
        if (!c || !output || c.state !== 'running' || this.settings.muted)
            return;
        if (sound === 'peek') {
            if (c.currentTime - this.lastPeek < .065)
                return;
            this.lastPeek = c.currentTime;
        }
        const noiseSound = ['card', 'flip', 'peek'].includes(sound);
        const duration = noiseSound ? .16 : sound === 'win' ? .65 : .13;
        const gain = c.createGain();
        gain.connect(output);
        const now = c.currentTime;
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(noiseSound ? .038 : .07, now + .005);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        if (noiseSound && this.noise) {
            const node = c.createBufferSource();
            node.buffer = this.noise;
            const filter = c.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = sound === 'peek' ? 950 : 1800;
            node.connect(filter);
            filter.connect(gain);
            node.start();
            node.stop(now + duration);
            node.onended = () => { node.disconnect(); filter.disconnect(); gain.disconnect(); };
        }
        else {
            const frequencies = { select: 900, chip: 1750, stack: 2100, button: 480, tick: 640, win: 660, loss: 220, settle: 440 };
            const tone = c.createOscillator();
            tone.type = 'sine';
            tone.frequency.setValueAtTime(frequencies[sound] ?? 600, now);
            tone.frequency.exponentialRampToValueAtTime(sound === 'win' ? 880 : (frequencies[sound] ?? 600) * .65, now + duration);
            tone.connect(gain);
            tone.start();
            tone.stop(now + duration);
            tone.onended = () => { tone.disconnect(); gain.disconnect(); };
        }
    }
}
