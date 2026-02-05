export async function parseErrorResponse(
    response: Response,
    fallbackMessage = 'Request failed'
): Promise<Error> {
    let message = fallbackMessage;

    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.clone().json().catch(() => null);
            if (data && typeof data === 'object') {
                const parsedMessage = (data as { error?: string; message?: string }).error
                    || (data as { error?: string; message?: string }).message;
                if (parsedMessage) {
                    message = parsedMessage;
                }
            }
        }

        if (message === fallbackMessage) {
            const text = await response.clone().text().catch(() => '');
            if (text) message = text;
        }
    } catch {
        // fall back to default message
    }

    if (!message || message === fallbackMessage) {
        message = `${fallbackMessage} (${response.status})`;
    } else if (!message.includes(String(response.status))) {
        message = `${message} (${response.status})`;
    }

    return new Error(message);
}
