/** Cached procedural clay-chip faces. Six textures, no per-frame canvas work. */
const cache = new Map();
const colors = { 50: '#6e8596', 100: '#796b8b', 500: '#467d77', 1000: '#b4ad95', 5000: '#994958', 10000: '#273540' };
export function chipTexture(value) {
    const cached = cache.get(value);
    if (cached)
        return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return '';
    const color = colors[value] ?? colors[1000];
    ctx.translate(80, 80);
    ctx.beginPath();
    ctx.arc(0, 0, 75, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    for (let i = 0; i < 10; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 5 + .07);
        ctx.fillStyle = '#e8e0c5';
        ctx.fillRect(-8, -75, 16, 22);
        ctx.fillStyle = '#3b4448';
        ctx.fillRect(-1, -75, 2, 20);
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#ede6cc';
    ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.strokeStyle = '#f2ead77a';
    ctx.stroke();
    ctx.setLineDash([]);
    const light = ctx.createLinearGradient(-60, -65, 45, 70);
    light.addColorStop(0, '#ffffff32');
    light.addColorStop(.5, '#ffffff00');
    light.addColorStop(1, '#0000003a');
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.fillStyle = light;
    ctx.fill();
    // Fixed micrograin avoids shimmering or random changes during flights.
    for (let i = 0; i < 450; i++) {
        const x = ((i * 73) % 143) - 71, y = ((i * 47) % 139) - 69;
        if (x * x + y * y < 5100) {
            ctx.fillStyle = i % 2 ? '#ffffff12' : '#00000012';
            ctx.fillRect(x, y, .8, .8);
        }
    }
    ctx.fillStyle = value === 1000 ? '#263336' : '#f0eadc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 29px Georgia,serif';
    ctx.fillText(value >= 1000 ? `${value / 1000}K` : String(value), 0, 2);
    ctx.font = '9px Georgia,serif';
    ctx.fillText('QUEEN', 0, -27);
    ctx.fillText('ENTERTAINMENT', 0, 27);
    const url = canvas.toDataURL();
    cache.set(value, url);
    return url;
}
