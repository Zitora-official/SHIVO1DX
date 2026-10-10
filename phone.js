
async function testAutomateBridge() {
    try {
        const result = await window.Shivoid.http.automate(
            "http://127.0.0.1:8080/task",
            { cmd: "test" }
        );

        console.log("Automate test result:", result);
    } catch (error) {
        console.error("Automate bridge error:", error);
    }
}
