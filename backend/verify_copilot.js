
async function test() {
    console.log("Testing POST http://localhost:3002/process ...");
    try {
        const res = await fetch("http://localhost:3002/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "TEST_PING" })
        });

        console.log("Status:", res.status, res.statusText);
        const text = await res.text();
        console.log("Body:", text);
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

test();
