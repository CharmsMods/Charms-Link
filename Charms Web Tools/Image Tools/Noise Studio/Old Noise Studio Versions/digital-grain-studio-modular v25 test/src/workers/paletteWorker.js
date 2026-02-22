
self.onmessage = function(e) {
    const { data, count } = e.data;
    const counts = {};
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        counts[hex] = (counts[hex] || 0) + 1;
    }

    const uniqueColors = Object.entries(counts).map(([hex, freq]) => {
        return {
            hex, freq,
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    });

    if (uniqueColors.length === 0) {
        postMessage({ palette: [] });
        return;
    }

    const resultPalette = [];
    uniqueColors.sort((a, b) => b.freq - a.freq);
    resultPalette.push(uniqueColors[0]);

    const dists = new Float32Array(uniqueColors.length).fill(1e10);

    const updateDists = (lastPicked) => {
        for (let i = 0; i < uniqueColors.length; i++) {
            const c = uniqueColors[i];
            const d = Math.sqrt(
                Math.pow(c.r - lastPicked.r, 2) +
                Math.pow(c.g - lastPicked.g, 2) +
                Math.pow(c.b - lastPicked.b, 2)
            );
            if (d < dists[i]) dists[i] = d;
        }
    };

    updateDists(resultPalette[0]);

    const targetCount = Math.min(count, uniqueColors.length);
    while (resultPalette.length < targetCount) {
        let bestIdx = -1;
        let maxMinDist = -1;

        for (let i = 0; i < uniqueColors.length; i++) {
            if (dists[i] > maxMinDist) {
                maxMinDist = dists[i];
                bestIdx = i;
            }
        }

        if (bestIdx === -1) break;
        const picked = uniqueColors[bestIdx];
        resultPalette.push(picked);
        updateDists(picked);
    }

    postMessage({ palette: resultPalette.map(c => c.hex) });
};
