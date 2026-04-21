export class FetchTimeoutError extends Error {
    timeoutMs: number;

    constructor(message: string, timeoutMs: number) {
        super(message);
        this.name = 'FetchTimeoutError';
        this.timeoutMs = timeoutMs;
    }
}

export async function fetchWithTimeout(
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {},
    timeoutMs: number = 30000
): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = init?.signal;
    let didTimeout = false;

    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else {
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (didTimeout) {
            throw new FetchTimeoutError(`请求超时（>${Math.ceil(timeoutMs / 1000)}s）`, timeoutMs);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
