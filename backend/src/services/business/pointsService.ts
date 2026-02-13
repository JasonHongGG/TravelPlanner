export async function deductPoints(
    userId: string,
    cost: number,
    description: string,
    authToken: string,
    metadata?: any,
    options?: {
        idempotencyKey?: string;
        transactionId?: string;
    }
): Promise<boolean> {
    if (cost <= 0) return true;
    if (!userId) return true;

    try {
        const dbUrl = process.env.DB_SERVER_URL || "http://localhost:3002";
        const idempotencyKey = options?.idempotencyKey || crypto.randomUUID();
        const transactionId = options?.transactionId || crypto.randomUUID();
        const response = await fetch(`${dbUrl}/users/${userId}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify({
                transaction: {
                    id: transactionId,
                    date: Date.now(),
                    amount: -cost,
                    type: 'spend',
                    description: description,
                    metadata: metadata
                }
            })
        });

        if (!response.ok) {
            console.error(`[Server] Point deduction failed for ${userId}: ${response.statusText}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[Server] Error contacting DB server:`, e);
        return false;
    }
}
