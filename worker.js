/**
 * Web Worker para búsqueda de patrones de bedrock
 * Se ejecuta en un hilo separado para no bloquear la UI
 */

// Importar el bundle de bedrock
importScripts('bedrock-bundle.js');

// Escuchar mensajes del hilo principal
self.addEventListener('message', function(e) {
    const { type, data } = e.data;

    if (type === 'SEARCH') {
        searchPattern(data);
    }
});

/**
 * Realiza la búsqueda de patrones
 */
function searchPattern(config) {
    const { seed, pattern, yLevel, searchRadius, maxMatches } = config;
    
    const startTime = Date.now();
    const reader = new BedrockReader(seed);
    const matches = [];
    
    const height = pattern.length;
    const width = pattern[0]?.length || 0;

    if (height === 0 || width === 0) {
        postMessage({
            type: 'COMPLETE',
            data: {
                matches: [],
                searchTime: Date.now() - startTime,
                blocksSearched: 0
            }
        });
        return;
    }

    // Extraer solo las celdas marcadas (optimización)
    const markedCells = [];
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            if (pattern[py][px] === 1) {
                markedCells.push({ dx: px, dz: py });
            }
        }
    }

    if (markedCells.length === 0) {
        postMessage({
            type: 'COMPLETE',
            data: {
                matches: [],
                searchTime: Date.now() - startTime,
                blocksSearched: 0
            }
        });
        return;
    }

    let blocksSearched = 0;
    let lastProgressUpdate = Date.now();
    const progressInterval = 500; // Actualizar progreso cada 500ms

    // Búsqueda en espiral desde 0,0 (más probable encontrar cerca del spawn)
    const searchArea = searchRadius * 2;
    let found = false;

    // Búsqueda exhaustiva bloque por bloque
    for (let worldX = -searchRadius; worldX <= searchRadius && !found; worldX++) {
        for (let worldZ = -searchRadius; worldZ <= searchRadius && !found; worldZ++) {
            blocksSearched++;

            // Actualizar progreso periódicamente
            if (Date.now() - lastProgressUpdate > progressInterval) {
                const progress = (blocksSearched / (searchArea * searchArea)) * 100;
                postMessage({
                    type: 'PROGRESS',
                    data: {
                        progress: progress.toFixed(2),
                        blocksSearched: blocksSearched,
                        currentX: worldX,
                        currentZ: worldZ
                    }
                });
                lastProgressUpdate = Date.now();
            }

            // Verificar si el patrón coincide en esta posición
            if (matchesPattern(reader, markedCells, worldX, worldZ, yLevel)) {
                matches.push({
                    x: worldX,
                    z: worldZ,
                    y: yLevel
                });

                // Informar del match encontrado
                postMessage({
                    type: 'MATCH_FOUND',
                    data: {
                        x: worldX,
                        z: worldZ,
                        y: yLevel,
                        totalFound: matches.length
                    }
                });

                // Si encontramos el límite de matches, parar
                if (matches.length >= maxMatches) {
                    found = true;
                }
            }
        }
    }

    // Enviar resultados finales
    postMessage({
        type: 'COMPLETE',
        data: {
            matches: matches,
            searchTime: Date.now() - startTime,
            blocksSearched: blocksSearched
        }
    });
}

/**
 * Verifica si el patrón coincide en una posición específica
 * Solo verifica las celdas marcadas por el usuario
 */
function matchesPattern(reader, markedCells, startX, startZ, yLevel) {
    for (let i = 0; i < markedCells.length; i++) {
        const cell = markedCells[i];
        const worldX = startX + cell.dx;
        const worldZ = startZ + cell.dz;
        
        // La celda marcada DEBE tener bedrock
        if (!reader.isBedrock(worldX, yLevel, worldZ)) {
            return false;
        }
    }
    return true;
}
