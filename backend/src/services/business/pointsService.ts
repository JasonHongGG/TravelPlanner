export async function deductPoints(
    userId: string,
    cost: number,
    description: string,
    authToken: string,
    metadata?: any
): Promise<boolean> {
    if (cost <= 0) return true;
    if (!userId) return true;

    try {
        const dbUrl = process.env.DB_SERVER_URL || "http://localhost:3002";
        const response = await fetch(`${dbUrl}/users/${userId}/transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'Idempotency-Key': crypto.randomUUID()
            },
            body: JSON.stringify({
                transaction: {
                    id: crypto.randomUUID(),
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
